react-conveyor changelog
========================

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
