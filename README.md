React Conveyor
==============

[![npm version](https://img.shields.io/npm/v/react-conveyor.svg?style=flat)](https://www.npmjs.com/package/react-conveyor)

Very basic React wrapper / Hoc to abstract async data fetching through promises. 

There are plenty of similar implementations and more complete data-fetching solutions floating around but the original inspirations were [Relay](https://facebook.github.io/relay/) (explains the internal `fragment` naming) and [heroku/react-refetch](https://github.com/heroku/react-refetch). This is mostly to unify the multiple iterations I had in various projects since we started using it at work. Original name was `DataProvider`, but well ... all similar combinations I could think of were taken on npm so `ReactConveyor` / `Conveyor` it is.

Usage
-----

Install the library:

    npm install react-conveyor


- Tested under `React@^15.0.0` but should work for `React@^14.0.0`.
- Expects `Object.assign` to be available.

You can wrap components at render time:

```.js
import React from 'react';
import ReactDOM from 'react-dom';
import Conveyor from 'react-conveyor';

async function fetchUserData(id) {
  const response = await fetch(`/user/${id}`);
  const data = await response.json();
  return data.user;
}

ReactDOM.render(
  <Conveyor
    userId={1}
    mapPropsToArgs={{
      user: props => props.userId
    }}
    fetch={{
      user: fetchUserData
    }}
  >
    { props => props.user
      ? <span>{props.user.name}</span>
      : <span>Loading user...</span> }
  </Conveyor>
  , document.getElementById('root')
);
```

If you prefer a more standard approach to HoC and wrap components statically (as opposed to composing components in a `render` function), you can use `Conveyor.wrapComponent` to create self contained components:

```.js
import Conveyor from 'react-conveyor';

const UserNameWidget(props) {
  return (
    props.user
    ? <span>{props.user.name}</span>
    : <span>Loading user...</span>
  );
}

async function fetchUserData(id) {
  const response = await fetch(`/user/${id}`);
  const data = await response.json();
  return data.user;
}

export default Conveyor.wrapComponent({
  fetch: {
    user: fetchUserData
  },
  mapPropsToArgs: {
    user: props => props.userId
  }
}, UserNameWidget);
```

API
---

### `ReactConveyor`

The component exposes the following props.

#### `fetch` (required): `{ [key: string]: (prop: any) => Promise<any> }`

`fragment -> loading function`.  
By default the component reloads all fragments on mount and whenever its props changes by calling all the loading functions with an object contaning all the **extra** props passed to it.

#### `children` (required): `(props: object) => React.ReactNode`

Everytime the status of a fragment changes (start fetching, promise resolves / or rejects) this function is called and its return value is rendered directly. 

The `props` argument can expect the following props:

- `missing`: List of missing fragments. `null` if none are missing.
- `inFlight`: List of fragments for which there is a promise waiting to resolve. `null` if none are currently being fetched.
- `errors`: map of applicable rejection reasons. `null` if no promise rejected.
- `reload`: Call this function to force a reload. Can also be called with a fragment name for a partial reload.
- `...rest`:
  - one prop for every member of the `fetch` prop containing the promise resolved value or `undefined`
  - any extra prop passed to `ReactConveyor`

To see if there is any error, missing or loading fragments and adapt the display accordingly, a simple truthiness check on `missing`, `inFlight` and `errors` should be sufficient.

#### `mapPropsToArgs`: `{ [key: string]: (props: object) => any }`

If set for a given fragment:

- The loading function will be called with the result of `props.mapPropsToArgs[fragment](props)`.
- Whenever the component receives new props the fragment will only reload if the result of `props.mapPropsToArgs['fragment'](props)` for current and next props are different (shallow equality check).


#### `refresh`: `number|{ [key: string]: number }`

If set, fragments will reload every `refresh` milliseconds after being successfully loaded. If a `Number` is provided, all fragments are refreshed at the same interval.
