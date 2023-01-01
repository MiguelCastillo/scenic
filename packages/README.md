The packages directory contains all the different modules available in scenic.
Modules like math, scene, renderer and such which are built into libraries
that make up the game engine.

Each one of the modules is published as its own npm module so that you can
use whatever makes most sense to you without bringing extra baggage you
may not need.

Each package has a `src/index.js` which is the API exported by the particular
package and each package generates a bundle in `dest` as a UMD module named
after the name of the package itself. All the packages are under the `@scenic`
organization in NPM so every published package is named like `@scenic/math` and
`@scenic/scene`. The bundler will normalize those names in the UMD definition
to `scenicscene` and `scenicmath`. It would be nice the bundler could also
export the exact package name.

TODO(miguel): improve the bundler to allow us to export the actual package name
rather than the cleaned up string version.

Configuration files like babelrc and eslistrc are symlinked to the files in the
packages directory. If you need a custom configuration file then feel free to
create separate non symlinked files in the module that needs it. To symlink
configuration files you can run a command like below from the root folder; be
sure to switch out `math` in the paths for the specific module you want to
configure.

```
$ ln -sf ../.eslintrc.js packages/math/.eslintrc.js
$ ln -sf ../.babelrc.json packages/math/.babelrc.json
```

To build all the modules in packages you can run `npm run build --workspaces`
in the root directory. That will go through each module with a package.json
file and build any artifacts as defined in the each of the modules own
package.json file. You can run `npm run build` in each module to build any
particular one as needed.

Each module also has tests that you can run with `npm run test --workspaces`,
and `npm run test` in each module if you want to run the tests for a particular
module.
