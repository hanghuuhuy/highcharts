(function (H) {
	var arrayMax = H.arrayMax,
		arrayMin = H.arrayMin,
		defined = H.defined,
		destroyObjectProperties = H.destroyObjectProperties,
		each = H.each,
		erase = H.erase,
		log2lin = H.log2lin,
		merge = H.merge;
/*
 * The object wrapper for plot lines and plot bands
 * @param {Object} options
 */
H.PlotLineOrBand = function (axis, options) {
	this.axis = axis;

	if (options) {
		this.options = options;
		this.id = options.id;
	}
};

H.PlotLineOrBand.prototype = {
	
	/**
	 * Render the plot line or plot band. If it is already existing,
	 * move it.
	 */
	render: function () {
		var plotLine = this,
			axis = plotLine.axis,
			horiz = axis.horiz,
			options = plotLine.options,
			optionsLabel = options.label,
			label = plotLine.label,
			width = options.width,
			to = options.to,
			from = options.from,
			isBand = defined(from) && defined(to),
			value = options.value,
			svgElem = plotLine.svgElem,
			path = [],
			addEvent,
			eventType,
			xs,
			ys,
			x,
			y,
			color = options.color,
			zIndex = options.zIndex,
			events = options.events,
			attribs = {},
			groupAttribs = {},
			renderer = axis.chart.renderer,
			groupName = isBand ? 'bands' : 'lines',
			group;

		// logarithmic conversion
		if (axis.isLog) {
			from = log2lin(from);
			to = log2lin(to);
			value = log2lin(value);
		}

		// plot line
		if (width) {
			path = axis.getPlotLinePath(value, width);
			/*= if (build.classic) { =*/
			attribs = {
				stroke: color,
				'stroke-width': width
			};
			if (options.dashStyle) {
				attribs.dashstyle = options.dashStyle;
			}
			/*= } =*/
			
		} else if (isBand) { // plot band

			path = axis.getPlotBandPath(from, to, options);
			/*= if (build.classic) { =*/
			if (color) {
				attribs.fill = color;
			}
			if (options.borderWidth) {
				attribs.stroke = options.borderColor;
				attribs['stroke-width'] = options.borderWidth;
			}
			/*= } =*/
		} else {
			return;
		}
		// zIndex
		if (defined(zIndex)) {
			groupAttribs.zIndex = zIndex;
			groupName += '-' + zIndex;
		}
		group = axis[groupName];
		if (!group) {
			axis[groupName] = group = renderer.g('plot-' + groupName)
				.attr(groupAttribs).add();
		}


		// Class
		attribs['class'] = 'highcharts-plot-' + (isBand ? 'band ' : 'line ') + (options.className || '');

		// common for lines and bands
		if (svgElem) {
			if (path) {
				svgElem.animate({
					d: path
				}, null, svgElem.onGetPath);
			} else {
				svgElem.hide();
				svgElem.onGetPath = function () {
					svgElem.show();
				};
				if (label) {
					plotLine.label = label = label.destroy();
				}
			}
		} else if (path && path.length) {
			plotLine.svgElem = svgElem = renderer.path(path)
				.attr(attribs).add(group);

			// events
			if (events) {
				addEvent = function (eventType) {
					svgElem.on(eventType, function (e) {
						events[eventType].apply(plotLine, [e]);
					});
				};
				for (eventType in events) {
					addEvent(eventType);
				}
			}
		}

		// the plot band/line label
		if (optionsLabel && defined(optionsLabel.text) && path && path.length && axis.width > 0 && axis.height > 0) {
			// apply defaults
			optionsLabel = merge({
				align: horiz && isBand && 'center',
				x: horiz ? !isBand && 4 : 10,
				verticalAlign : !horiz && isBand && 'middle',
				y: horiz ? isBand ? 16 : 10 : isBand ? 6 : -4,
				rotation: horiz && !isBand && 90
			}, optionsLabel);

			// add the SVG element
			if (!label) {
				attribs = {
					align: optionsLabel.textAlign || optionsLabel.align,
					rotation: optionsLabel.rotation
				};
				if (defined(zIndex)) {
					attribs.zIndex = zIndex;
				}
				plotLine.label = label = renderer.text(
						optionsLabel.text,
						0,
						0,
						optionsLabel.useHTML
					)
					.attr(attribs)
					.css(optionsLabel.style)
					.add();
			}

			// get the bounding box and align the label
			// #3000 changed to better handle choice between plotband or plotline
			xs = [path[1], path[4], (isBand ? path[6] : path[1])];
			ys = [path[2], path[5], (isBand ? path[7] : path[2])];
			x = arrayMin(xs);
			y = arrayMin(ys);

			label.align(optionsLabel, false, {
				x: x,
				y: y,
				width: arrayMax(xs) - x,
				height: arrayMax(ys) - y
			});
			label.show();

		} else if (label) { // move out of sight
			label.hide();
		}

		// chainable
		return plotLine;
	},

	/**
	 * Remove the plot line or band
	 */
	destroy: function () {
		// remove it from the lookup
		erase(this.axis.plotLinesAndBands, this);
		
		delete this.axis;
		destroyObjectProperties(this);
	}
};

/**
 * Object with members for extending the Axis prototype
 * @todo Extend directly instead of adding object to Highcharts first
 */

H.AxisPlotLineOrBandExtension = {

	/**
	 * Create the path for a plot band
	 */ 
	getPlotBandPath: function (from, to) {
		var toPath = this.getPlotLinePath(to, null, null, true),
			path = this.getPlotLinePath(from, null, null, true);

		if (path && toPath && path.toString() !== toPath.toString()) { // #3836
			path.push(
				toPath[4],
				toPath[5],
				toPath[1],
				toPath[2]
			);
		} else { // outside the axis area
			path = null;
		}
		
		return path;
	},

	addPlotBand: function (options) {
		return this.addPlotBandOrLine(options, 'plotBands');
	},
	
	addPlotLine: function (options) {
		return this.addPlotBandOrLine(options, 'plotLines');
	},

	/**
	 * Add a plot band or plot line after render time
	 *
	 * @param options {Object} The plotBand or plotLine configuration object
	 */
	addPlotBandOrLine: function (options, coll) {
		var obj = new H.PlotLineOrBand(this, options).render(),
			userOptions = this.userOptions;

		if (obj) { // #2189
			// Add it to the user options for exporting and Axis.update
			if (coll) {
				userOptions[coll] = userOptions[coll] || [];
				userOptions[coll].push(options); 
			}
			this.plotLinesAndBands.push(obj); 
		}
		
		return obj;
	},

	/**
	 * Remove a plot band or plot line from the chart by id
	 * @param {Object} id
	 */
	removePlotBandOrLine: function (id) {
		var plotLinesAndBands = this.plotLinesAndBands,
			options = this.options,
			userOptions = this.userOptions,
			i = plotLinesAndBands.length;
		while (i--) {
			if (plotLinesAndBands[i].id === id) {
				plotLinesAndBands[i].destroy();
			}
		}
		each([options.plotLines || [], userOptions.plotLines || [], options.plotBands || [], userOptions.plotBands || []], function (arr) {
			i = arr.length;
			while (i--) {
				if (arr[i].id === id) {
					erase(arr, arr[i]);
				}
			}
		});
	}
};

	return H;
}(Highcharts));
