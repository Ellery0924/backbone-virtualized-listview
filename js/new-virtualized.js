import Backbone from 'backbone';
import $ from 'jquery';
import _ from 'underscore';
import defaultListTemplate from './default-list.jade';
import defaultItemTemplate from './default-item.jade';
import { ElementViewport, WindowViewport } from './viewport.js';

const INVALIDATION_NONE = 0;
const INVALIDATION_ITEMS = 0x1;
const INVALIDATION_EVENTS = 0x2;
const INVALIDATION_LIST = 0x4;
const INVALIDATION_ALL = 0x7;

const LIST_VIEW_EVENTS = ['willRedraw', 'didRedraw'];

export default class ListView extends Backbone.View {
  initialize({
    virtualized = true,
    viewport = null,
    batchSize = 20,
  } = {}) {
    this._props = { virtualized, viewport, batchSize };
    this.options = {
      model: {},
      listTemplate: defaultListTemplate,
      events: {},
      items: [],
      itemTemplate: defaultItemTemplate,
      defaultItemHeight: 20,
    };
    this._state = {
      removed: false,
      invalidation: INVALIDATION_NONE,
    };
    this._scheduleRedraw = _.noop;
  }

  _initViewport() {
    const viewport = this._props.viewport;

    if (_.isString(viewport)) {
      return new ElementViewport(this.$(viewport));
    } else if (viewport instanceof $) {
      if (viewport.get(0) === window) {
        return new WindowViewport();
      }
      return new ElementViewport(viewport);
    } else if (viewport instanceof HTMLElement) {
      return new ElementViewport(viewport);
    } else if (viewport === window) {
      return new WindowViewport();
    }

    let $el = this.$el;
    while ($el.length > 0 && !$el.is(document)) {
      if (_.contains(['auto', 'scroll'], $el.css('overflowY'))) {
        return new ElementViewport($el);
      }
      $el = $el.parent();
    }
    return new WindowViewport();
  }

  _hookUpViewport() {
    this.viewport = this._initViewport();

    if (this.virtualized) {
      let blockUntil = 0;

      const onViewportChange = () => {
        if (performance.now() > blockUntil) {
          this._scheduleRedraw();
        } else if (!this._state.removed) {
          // If the scroll events are blocked, we shouldn't just swallow them.
          // Wait for 0.1 second and give another try.
          window.setTimeout(onViewportChange, 100);
        }
      };

      this.viewport.on('change', onViewportChange);

      //
      // On keypress, we want to block the scroll events for 0.2 second to wait
      // for the animation to complete. Otherwise, the scroll would change the
      // geometry metrics and break the animation. The worst thing we may get is,
      // for 'HOME' and 'END' keys, the view doesn't scroll to the right position.
      //
      this.viewport.on('keypress', () => {
        blockUntil = performance.now() + 200;
      });
    }
  }

  /**
   * Set the list view options. The following options can be set
   *
   * __model__: The model object to render the skeleton of the list view.
   *
   * __listTemplate__: The template to render the skeleton of the list view.
   *
   *  * By default, it would render a single `UL`.
   *  * __Note__: It must contain the following elements with specified class
   *    names as the first and last siblings of the list items. All list items
   *    will be rendered in between.
   *    * `'top-filler'`: The filler block on top.
   *    * `'bottom-filler'`: The filler block at bottom.
   *
   * __events__: The events hash in form of `{ "event selector": callback }`.
   *
   *  * Refer to {@link http://backbonejs.org/#View-events|Backbone.View~events}
   *  * In addition to the DOM events, it can also handle the `'willRedraw'` and
   *    `'didRedraw'` events of the list view.
   *  * __Note__: The callback __MUST__ be a function. Member function names are
   *    not supported.
   *
   * __items__: The model objects of the list items.
   *
   * __itemTemplate__: The template to render a list item.
   *
   *  * By default, it would render a single `LI` filled with `item.text`.
   *  * __Note__: list items __MUST NOT__ have outer margins, otherwise the layout
   *    calculation will be inaccurate.
   *
   * __defaultItemHeight__: The estimated height of a single item.
   *
   *  * It's not necessary to be accurate. But the accurater it is, the less the
   *    scroll bar is adjusted overtime.
   *
   * Refer to {@link ListView} for detail.
   *
   * @param {Object} options The new options.
   * @param {Object} options.model
   * @param {ListView~cbListTemplate} [options.listTemplate]
   * @param {Object} options.events
   * @param {Object[]} [options.items=[]]
   * @param {ListView~cbItemTemplate} [options.itemTemplate]
   * @param {number} [options.defaultItemHeight=20]
   * @param {function} [callback] The callback to notify completion.
   * @return {ListView} The list view itself.
   */
  set(options = {}, callback = _.noop) {
    const isSet = key => !_.isUndefined(options[key]);
    let invalidation = INVALIDATION_NONE;

    _.extend(this.options, options);

    if (_.some(['model', 'listTemplate'], isSet)) {
      invalidation |= INVALIDATION_ALL;
    } else {
      if (_.some(['items', 'itemTemplate', 'defaultItemHeight'], isSet)) {
        if (isSet('defaultItemHeight') ||
          this.itemHeights.maxVal !== this.length) {
          this._itemHeights = null;
        }
        invalidation |= INVALIDATION_ITEMS;
      }
      if (isSet('events')) {
        invalidation |= INVALIDATION_EVENTS;
      }
    }

    if (invalidation) {
      this._invalidate(invalidation, callback);
    } else {
      callback();
    }

    return this;
  }

  _invalidate(invalidation, callback) {
    this._state.invalidation |= invalidation;
    this._scheduleRedraw(true);
    this.once('didRedraw', callback);
  }

  _processInvalidation() {
    const { events, listTemplate, model } = this.options;
    const { invalidation } = this._state;
    const eventsDOM = _.omit(events, LIST_VIEW_EVENTS);
    const eventsListView = _.pick(events, LIST_VIEW_EVENTS);

    if (invalidation & INVALIDATION_EVENTS) {
      this.undelegateEvents();
      _.each(this._state.eventsListView || {}, (handler, event) => {
        this.off(event, handler);
      });
    }
    if (invalidation & INVALIDATION_LIST) {
      const isInternalViewport = _.isString(this._props.viewport);
      if (isInternalViewport && this.viewport) {
        this.viewport.remove();
        this.viewport = null;
      }
      this.$el.html(listTemplate(model));
      if (!this.viewport) {
        this._hookUpViewport();
      }
    }
    if (invalidation & INVALIDATION_EVENTS) {
      this.delegateEvents(eventsDOM);
      _.each(eventsListView, (handler, event) => {
        this.on(event, handler);
      });
      this._state.eventsListView = eventsListView;
    }
    const invalidateItems = invalidation & INVALIDATION_ITEMS;

    _.extend(this._state, { invalidation: INVALIDATION_NONE });
    return invalidateItems;
  }

  _redraw() {
    let invalidateItems = this._processInvalidation();
    const { items } = this.options;

    if (!invalidateItems && items.length === 0) {
      return;
    }
  }

  render(callback = _.noop) {
    let animationFrameId = null;
    let timeoutId = null;

    const redraw = () => {
      animationFrameId = null;
      timeoutId = null;
      if (!this._state.removed) {
        this._redraw();
      }
    };

    this._scheduleRedraw = (ignoreAnimationFrame = false) => {
      if (!timeoutId) {
        if (ignoreAnimationFrame) {
          timeoutId = window.setTimeout(redraw, 0);
          if (animationFrameId) {
            window.cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
          }
        } else if (!animationFrameId) {
          animationFrameId = window.requestAnimationFrame(redraw);
        }
      }
    };

    this._hookUpViewport();
    this._invalidate(INVALIDATION_ALL, callback);
    return this;
  }
}
