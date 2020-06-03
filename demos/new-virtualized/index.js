import _ from 'underscore';
import ListView from '../../js/new-virtualized';
import itemTemplate from './item-template.jade';
import 'style!css!./index.css';

window.listView = new ListView({
  viewport: '.container',
  items: _.map(_.range(200), i => ({ text: i })),
  itemHeight: 81,
  itemTemplate,
}).render();
