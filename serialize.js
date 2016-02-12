/**
 * serialize.js
 *
 * Convert JS data types into string representations parsable by PHP's unserialize() function.
 *
 * Copyright (c) 2016 Stephen Beemsterboer
 * Released under the MIT license
 *
 */
;(function(){
	window.PHP = window.PHP || {};

	/**
	 * Serialize a JS value for PHP consumption
	 * @param  {mixed} data  any piece of data represented in JS
	 * @param  {bool} assoc  whether to convey objects as associative arrays
	 * @return {string}      the serialized value as a string
	 */
	PHP.serialize = function(data, assoc) {
		switch(typeof data) {
			case 'string':
				return 's:' + data.length + ':"' + data + '";';
			case 'number':
				if (isNaN(data)) return 'd:NAN;';
				if (!isFinite(data)) return 'd:' + (data>0?'':'-') + 'INF;';
				if (Number.isInteger(data)) return 'i:' + data + ';';
				return 'd:' + data + ';';
			case 'boolean':
				return 'b:' + +data + ';';
			case 'object':
			case 'function':
				if (!data) return 'N;';
				if (Array.isArray(data)) {
					// for loop is the best way to handle the possibility of sparse arrays
					for(var out='a:'+data.length+':{',i=0; i<data.length; i++) {
						out += PHP.serialize(i) + PHP.serialize(data[i]);
					}
					return out + '}';
				}
				var keys = Object.keys(data);
				return (assoc?'a:':'O:8:"stdClass":') + keys.length + ':{'
					+ keys.reduce(function(running, key){
						return running + PHP.serialize(key) + PHP.serialize(data[key]);
					}, '') + '}';
			default:
				// treat anything else as null
				// this includes undefined, since PHP does not have that type
				return 'N;';
		}
	};

})();
