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
		var s = str.length, code, i;
		for (i=s-1; i>=0; i--) {
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
	 * Serialize a JS value for PHP consumption.
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
				// "not a number" is of type "number" LOL, oh JS...
				if (isNaN(data)) return 'd:NAN;';
				if (!isFinite(data)) return 'd:' + (data>0?'':'-') + 'INF;';
				// integers in scientific notation must be conveyed as doubles
				if (PHP.is_int(data)&&data.toString().search(/e/i)===-1) return 'i:' + data + ';';
				return 'd:' + data + ';';
			case 'boolean':
				return 'b:' + +data + ';';
			case 'object':
			case 'function':
				// a falsey object can only be null
				if (!data) return 'N;';
				if (Array.isArray(data)) {
					// for loop is the best way to handle the possibility of sparse arrays
					for (var out='a:'+data.length+':{',i=0; i<data.length; i++) {
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

	/**
	 * Unserialize a string and return an array with the unserialized value and the number of consumed bytes.
	 * This is an internal function because the number of consumed bytes is only meaningful for
	 * unserializing nested arrays and objects.
	 * @param  {string} str the serialized string
	 * @return {array}      [value,consumed bytes]
	 */
	var unserialize = function(str) {
		var match, offset = 0;
		if (typeof str !== 'string') throw new Error('Unexpected type ' + typeof str);
		// null
		if (str.indexOf('N;')===0) return [null,2];
		switch(str[offset]) {
			// boolean
			case 'b':
				if (match=str.match(/^b:([01]);/)) return [!!+match[1], 4];
				break;
			// integer
			case 'i':
				if (match=str.match(/^i:(-?\d+);/)) return [+match[1], match[0].length];
				break;
			// double
			case 'd':
				if (str.indexOf('d:NAN;')===0) return [NaN,6];
				if (match=str.match(/^d:(-)?INF;/)) return [Infinity * (match[1]?-1:1), match[0].length];
				if (match=str.match(/^d:(-?(?:\d+\.?\d*|\d*\.?\d+)(?:[eE]-?\d+)?);/)) return [+match[1], match[0].length];
				break;
			// string
			case 's':
				if (match=str.match(/^s:(\d+):"/)) {
					var bytes = +match[1], byteCount, chr, value = '';
					// start right after opening quote
					offset = match[0].length;
					for(byteCount = 0; byteCount<bytes && (chr = str[offset]); offset++) {
						byteCount += PHP.strlen(chr);
						value += chr;
					}
					// did we match all the specified bytes, followed by a quote and optionally a semicolon or closing brace?
					if (byteCount===bytes&&str[offset++]==='"') return [value, offset+ +(str[offset]===';'||str[offset]==='}')];
				}
				break;
			// array or object
			case 'a':
			case 'O':
				if (match=str.match(/^(a|O:\d+:".+?"):(\d+):{/)) {
					var items = match[2]*2, itemCount, arr, obj = {}, isArr = match[1]==='a', key, item;
					// array could be an assoc array, which must be an object in JS
					// for arrays, fill arr and obj until we know it is not a JS array
					if (isArr) arr = [];
					// start right after opening brace
					offset = match[0].length;
					for (itemCount = 0; itemCount<items; itemCount++) {
						// catch possible unserialize error within
						try {
							item = unserialize(str.substr(offset));
							// advance the offset by how many characters were consumed by this item
							offset += item[1];
							// check to make sure the last char was a semicolon or closing brace
							if (str[offset-1].search(/[;}]/)===-1) break;
							// even number?
							if (itemCount%2===0) {
								key = item[0];
							} else {
								if (isArr&&key===arr.length) arr.push(item[0]);
								else isArr = false;
								// when an object's private and protected properties are serialized,
								// their names are prepended with an identifier surrounded by null bytes,
								// so strip this off the beginning of the key name
								obj[key.toString().replace(/^\0.+\0/,'')] = item[0];
							}
						} catch (e) {
							if (typeof e.offset!=='number') throw e;
							// add the offset so we know overall where the error occured
							offset += e.offset;
							break;
						}
					}
					// did we have all the specified key and value pairs followed by a closing brace?
					if (str[offset++]==='}'&&itemCount===items) {
						return [isArr ? arr : obj, offset];
					}
				}
				break;
		}
		var err = new Error('Error at offset ' + offset + ' of ' + PHP.strlen(str) + ' bytes');
		err.offset = offset;
		throw err;
	};

	/**
	 * Unserialize a string representation of data produced by PHP's serialize function.
	 * Throws an exception if the string cannot be parsed.
	 * @param  {string} str the serialized string
	 * @return {mixed}      the unserialized value
	 */
	PHP.unserialize = function(str) {
		return unserialize(str)[0];
	};

})();
