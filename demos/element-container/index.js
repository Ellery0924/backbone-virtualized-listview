import _ from 'underscore';
import ListView from '../../js/index';
import itemTemplate from './item-template.jade';
import 'style!css!./index.css';

window.listView = new ListView({
  el: '.container',
}).set({
  items: _.map(_.range(200), i => ({ text: i })),
  defaultItemHeight: 50,
  itemTemplate,
}).render();
