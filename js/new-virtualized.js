import Backbone from 'backbone';
import _ from 'underscore';
import $ from 'jquery';
import defaultListTemplate from './default-list.jade';
import defaultItemTemplate from './default-item.jade';

const DIRECTION_DOWN = 'down';
const DIRECTION_UP = 'up';

class VirtualizedList extends Backbone.View {
  initialize({
    viewport = null,
    items = [],
    itemHeight = 20,
    itemTemplate = defaultItemTemplate,
    listTemplate = defaultListTemplate,
    batchSize = 20,
  }) {
    this._props = { viewport };
    this.options = {
      itemTemplate,
      listTemplate,
      itemHeight,
      items,
      batchSize,
    };
    this.$contentContainer = $('<div></div>').addClass('content');
    this.$placeHolderNodes = [];
    this._state = {
      start: 0,
      placeholderIndex: 0,
      scrollTop: 0,
      direction: DIRECTION_DOWN,
    };
  }

  _initViewport() {
    const viewport = this._props.viewport;
    const totalHeight = this._calculateHeight();
    const $viewport = $(viewport);
    $viewport.css('position', 'relative').css('overflow', 'auto');
    $viewport.empty().append(this.$contentContainer);
    this.$contentContainer.height(totalHeight);
    return $viewport;
  }

  _hookUpViewport() {
    this.$viewport = this._initViewport();
    this.$viewport.on('scroll', () => {
      const newScrollTop = this.$viewport.scrollTop();
      const prevScrollTop = this._state.scrollTop;
      this._state.direction = newScrollTop > prevScrollTop ? DIRECTION_DOWN : DIRECTION_UP;
      this._state.scrollTop = newScrollTop;
      this._draw();
    });
  }

  _findStart(scrollTop = 0) {
    const { items, itemHeight } = this.options;
    const { start } = this._state;
    let accTop = start * itemHeight;
    let newStart = -1;
    for (let i = start; i < items.length; i++) {
      const bottom = accTop + itemHeight;
      if (bottom >= scrollTop) {
        newStart = i;
        break;
      } else {
        accTop = bottom;
      }
    }
    return newStart;
  }

  _updatePlaceholder($placeholder, item, index) {
    const { itemHeight, itemTemplate } = this.options;
    const itemTop = itemHeight * index;
    const $content = $(itemTemplate(item));
    $placeholder.html($content).css('transform', `translate(0,${itemTop}px)`);
  }

  _initItems() {
    const { batchSize, items } = this.options;
    for (let i = 0; i < batchSize; i++) {
      const $placeholder = this.$placeHolderNodes[i];
      const item = items[i];
      this._updatePlaceholder($placeholder, item, i);
    }
  }

  _draw() {
    window.requestAnimationFrame(() => {
      const { batchSize } = this.options;
      const { direction, scrollTop } = this._state;
      const newStart = this._findStart(scrollTop);

      if (direction === DIRECTION_DOWN && newStart !== this._state.start) {
        let updateIndex = this._state.start + batchSize;
        while (updateIndex < newStart + batchSize) {
          const { placeholderIndex } = this._state;
          const item = this.options.items[updateIndex];
          const $placeholder = this.$placeHolderNodes[placeholderIndex];
          if ($placeholder) {
            this._updatePlaceholder($placeholder, item, updateIndex, placeholderIndex);
          }
          updateIndex++;
          this._state.placeholderIndex = (this._state.placeholderIndex + 1) % this.$placeHolderNodes.length;
        }
        this._state.start = newStart;
      }
    });
  }

  _initPlaceholders() {
    const { batchSize, itemHeight } = this.options;
    this.$placeHolderNodes = new Array(batchSize).fill(1).map((_, index) => {
      const node = $(`<div data-list-index="${index}"></div>`)
        .height(itemHeight)
        .css('position', 'absolute')
        .css('top', 0)
        .css('left', 0)
        .css('right', 0)
        .css('transform', 'translate(0, 0)')
        .css('will-change', 'transform');
      this.$contentContainer.append(node);
      return node;
    });
  }

  _calculateHeight() {
    const { items, itemHeight } = this.options;
    return items.length * itemHeight;
  }

  render() {
    this._hookUpViewport();
    this._initPlaceholders();
    this._initItems();
  }
}

export default VirtualizedList;
