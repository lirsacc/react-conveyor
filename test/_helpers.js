import sinon from 'sinon';

/**
 * Promise version of setTimeout.
 */
export async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make a function which creates promises that are programatically rejected
 * or resolved for orchestration purposes.
 * They are also sinon.js spies.
 */
export function controlledPromiseFactory() {

  const calls = [];

  function func(...args) {

    let _resolve, _reject;

    const q = new Promise((resolve, reject) => {
      _resolve = resolve;
      _reject = reject;
    });

    calls.push({
      args, q,
      resolve: _resolve,
      reject: _reject,
      handled: false,
    });

    return q;
  }

  function _call(index) {
    const call = calls[index];
    if (!call) {
      throw new ReferenceError(`No call at ${index}`);
    } else {
      return call;
    }
  }

  const resolve = (index, value) => {
    const call = _call(index);
    if (call.handled) throw new Error('Controlled call already handled.');
    call.resolve(value);
  };

  const reject = (index, err) => {
    const call = _call(index);
    if (call.handled) throw new Error('Controlled call already handled.');
    call.reject(err);
  };

  func.resolve = resolve;
  func.reject = reject;

  return sinon.spy(func);
}
