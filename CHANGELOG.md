react-conveyor changelog
========================

Changes with version x.x.x
--------------------------

Changes with version 0.0.4
--------------------------

No changes, just fixing a bad `npm publish`.

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
