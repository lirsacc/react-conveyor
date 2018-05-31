react-conveyor changelog
========================

Changes with version x.x.x
--------------------------

- Adapt to the new [React 16.3 lifecycle methods and deprecation](https://reactjs.org/blog/2018/03/27/update-on-async-rendering.html#initializing-state). This only uses the existing `componentDidUpdate` instead of `componentWillReceiveProps` so there shouldn't be any change for usage under React@14 and React@15.
- Changes to exposed state:
  - Do not expose internal `missing` state anymore and fold it into `inFlight`
  - Split `inFLight` into `inFlight` and `inFlightMutations` to make it easier
    to consume and display conditional loading state

Changes with version 0.2.0
--------------------------

- Add support for `replaceOnMutation` being a function and replacing multiple fields at once.
- Fix bug that would nullify mutations after `replaceOnMutation` behaviour came into play.

Changes with version 0.1.0
--------------------------

Changes with version 0.0.5
--------------------------

- Do not create inline function on each render for wrapped components, it lead to useless re-renders when used inside other components.

Changes with version 0.0.4
--------------------------

- No changes, just fixing a bad `npm publish`.

Changes with version 0.0.3
--------------------------

- Update tests and peerDependencies for React@16
- Remove `refresh` prop and behaviour

Changes with version 0.0.2
--------------------------

- Change `prepublish` script to `prepublishOnly`.  
  See: https://docs.npmjs.com/misc/scripts#prepublish-and-prepare.
- Do not prevent fragments from updating when one promise is already in fight.
- **Breaking** Rename `fetch` prop to `fields` + all internal mention of `fragment` to `field`.
- Add support for mutations.


Changes with version 0.0.1
--------------------------

- Initial push to NPM.
