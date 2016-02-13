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
	 * Like PHP's strlen(), return the byte length of a string.
	 * Taken from: http://stackoverflow.com/a/23329386/5803236
	 * @param  {string} str the string
	 * @return {int}     byte length, assuming utf8
	 */
	PHP.strlen = function(str) {
		var s = str.length, code;
		for (var i=s-1; i>=0; i--) {
			code = str.charCodeAt(i);
			if (code > 0x7f && code <= 0x7ff) s++;
			else if (code > 0x7ff && code <= 0xffff) s+=2;
			if (code >= 0xDC00 && code <= 0xDFFF) i--; //trail surrogate
		}
		return s;
	};

	/**
	 * Determine if the value is an integer.
	 * @param  {mixed}  value value to test
	 * @return {bool}      determination
	 */
	PHP.is_int = function(value) {
		return typeof value === 'number' &&
			isFinite(value) &&
			Math.floor(value) === value;
	};

	/**
	 * Serialize a JS value for PHP consumption
	 * @param  {mixed} data  any piece of data represented in JS
	 * @param  {bool} assoc  whether to convey objects as associative arrays (default: false)
	 * @param  {bool} nonEnum whether to serialize non-enumerable properties (default: false)
	 * @return {string}      the serialized value as a string
	 */
	PHP.serialize = function(data, assoc, nonEnum) {
		switch(typeof data) {
			case 'string':
				return 's:' + PHP.strlen(data) + ':"' + data + '";';
			case 'number':
				if (isNaN(data)) return 'd:NAN;';
				if (!isFinite(data)) return 'd:' + (data>0?'':'-') + 'INF;';
				// integers in scientific notation must be conveyed as doubles
				if (PHP.is_int(data)&&data.toString().search(/e/i)===-1) return 'i:' + data + ';';
				return 'd:' + data + ';';
			case 'boolean':
				return 'b:' + +data + ';';
			case 'object':
			case 'function':
				if (!data) return 'N;';
				if (Array.isArray(data)) {
					// for loop is the best way to handle the possibility of sparse arrays
					for(var out='a:'+data.length+':{',i=0; i<data.length; i++) {
						out += PHP.serialize(i) + PHP.serialize(data[i], assoc, nonEnum);
					}
					return out + '}';
				}
				var keys = Object[nonEnum?'getOwnPropertyNames':'keys'](data);
				return (assoc?'a:':'O:8:"stdClass":') + keys.length + ':{'
					+ keys.reduce(function(running, key){
						return running + PHP.serialize(key) + PHP.serialize(data[key], assoc, nonEnum);
					}, '') + '}';
		}
		// treat anything else as null
		// this includes undefined, since PHP does not have that type
		return 'N;';
	};

})();
