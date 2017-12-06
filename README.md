React Conveyor
==============

[![npm version](https://img.shields.io/npm/v/react-conveyor.svg?style=flat)](https://www.npmjs.com/package/react-conveyor) [![Build Status](https://travis-ci.org/lirsacc/react-conveyor.svg?branch=master)](https://travis-ci.org/lirsacc/react-conveyor)

Basic React wrapper / Hoc to abstract async data fetching through promises.

Plenty of similar implementations and more complete data-fetching solutions already exist but the original inspirations were [Relay](https://facebook.github.io/relay/) (explains the internal `fragment` naming used originally) and [heroku/react-refetch](https://github.com/heroku/react-refetch). This is to unify the existing iterations since we started using it at work. Original name was `DataProvider`, but well ... all similar combinations I could think of were taken on npm so `ReactConveyor` / `Conveyor` it is.

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
    fields={{
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
  fields: {
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

#### `fields` (required): `{ [key: string]: (prop: any) => Promise<any> }`

`field -> loading function`  
By default the component reloads all fields on mount and whenever its props changes by calling all the loading functions with an object containing all the **extra** props passed to it.

#### `mutations`: `{ [key: string]: (prop: ...any[]) => Promise<any> }`

`mutationName -> mutator`  
All mutators will be passed with the same name to the children but bound to the `Conveyor` instance so that calling it will expose the mutation name in the `inFlight` and `errors` children props as applicable.  
Keys must not conflict with the `fields` prop.


#### `children` (required): `(props: object) => React.ReactNode`

Every time the status of a field changes (start fetching, promise resolves / or rejects) this function is called and its return value is rendered directly.

The `props` argument can expect the following props:

- `missing`: List of missing fields. `null` if none are missing.
- `inFlight`: List of fields / mutations for which there is a promise waiting to resolve. `null` if none are being fetched.
- `errors`: map of applicable rejection reasons for fields and mutations. `null` if no promise rejected.
- `reload`: Call this function to force a reload. Can also be called with a field name for a partial reload.
- `...rest`:
  - one prop for every member of the `fields` prop containing the promise resolved value or `undefined`
  - one prop for every entry in `mutation`.
  - any extra prop passed to `ReactConveyor`

To see if there is any error, missing or loading fields and adapt the display accordingly, a simple truthiness check on `missing`, `inFlight` and `errors` should be enough.

#### `mapPropsToArgs`: `{ [key: string]: (props: object) => any }`

If set for a given field:

- The loading function will be called with the result of `props.mapPropsToArgs[field](props)`.
- Whenever the component receives new props the field will only reload if the result of `props.mapPropsToArgs['field'](props)` for current and next props are different (shallow equality check).
