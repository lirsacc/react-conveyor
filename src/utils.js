/**
 * Some very basic utility functions.
 */

/**
 * Shallow equality check.
 *
 * @param {object} obj1
 * @param {object} obj2
 * @returns {boolean}
 */
export function shallowEqual(obj1, obj2) {
  if (obj1 === obj2) return true;
  if (obj1 == null || obj2 == null) return false;
  if (!isObject(obj1) || !isObject(obj2)) return false;

  for (let i in obj1) {
    if (!(i in obj2)) {
      return false;
    }
  }

  for (let i in obj2) {
    if (obj1[i] !== obj2[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Extract keys from a plain object.
 *
 * @param {object} obj
 * @param {string[]} keys
 * @returns {object}
 */
export function omit(obj, keys) {
  if (!keys || !keys.length) return obj;
  if (keys.every(key => !(key in obj))) return obj;

  return (
    Object
      .keys(obj)
      .filter(key => keys.indexOf(key) === -1)
      .reduce((reduced, key) => ({...reduced, [key]: obj[key]}), {})
  );
}


/**
 * Pick keys from a plain object.
 *
 * @param {object} obj
 * @param {string[]} keys
 * @returns {object}
 */
export function pick(obj, keys) {
  if (!keys || !keys.length) return {};
  const objKeys = Object.keys(obj);
  const matchingKeys = objKeys.filter(key => keys.indexOf(key) > -1);

  if (matchingKeys.length === objKeys.length) {
    return obj;
  } else {
    return matchingKeys.reduce((reduced, key) => ({...reduced, [key]: obj[key]}), {});
  }
}

export function isFunction(value) {
  return isObject(value) && Object.prototype.toString.call(value) === '[object Function]';
}

export function isObject(value) {
  const type = typeof value;
  return value != null && (type === 'object' || type === 'function');
}
