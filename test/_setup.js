// Silences the Warning from React about missing RAf.
global.requestAnimationFrame = (cb) => {  // eslint-disable-line
  setTimeout(cb, 0);
};

const Enzyme = require('enzyme');
const Adapter = require('enzyme-adapter-react-16');

Enzyme.configure({adapter: new Adapter()});

// Enzyme v2 lifecycle behaviour in shallow mode.
Enzyme.configure({ disableLifecycleMethods: true });
