# scenic

Scene graph renderer. Early work in progress.

Scenic uses a configuraton first approach where you define the hierarcy of
nodes in your scene. You are also welcome to manually put together the
nodes in a scene yourself if that's what you prefer.

You can take at this sample scene rendering skinned animation in scenic editor,
which is an application that renders a scene. [Scenic Editor](https://scenic-editor.herokuapp.com/editor/index.html)

![dancing-character](https://user-images.githubusercontent.com/1457701/163882070-23ef08d0-a0da-4b0b-95e7-f36e8c84186d.gif)

Quick intro:

1. Click on the rendering canvas to enter interactive mode (enable mouse tracking on the canvas)
2. One (and two fingers on mouse track) will rotate the scene on its origin
3. Crtl + one (or two fingers on mouse track) will translate the scene along the Z axies
4. Shift + one (or two fingers on mouse track) will translate the scene along the X and Y axis
5. Press ESC to exit interactive mode

## File formats

It has support for loading FBX files with most features. But there are a few
that are not supported like pre rotation and post rotation matrices. Usually
if a model cannot be loaded is because of that. Just import it and re-export
it in Blender for now.

It also has support for OBJ files (without mtl). Usually a quick way to feed
some geometry for rendering.

## Dev

Minimum version of Node is 14. That's what we are running in prod for the server and bundling.

To start up the server locally, you can `npm run serve`. That will startup
the build system, file watching, and your local dev server. To load up the
editor you can navigate to http://localhost:3000/editor/index.html

The usual `npm run test` will run all the tests.

If you just want to build all the artifacts, you can use `npm run build`.

Currently, there are three bundles generated:

1. The editor. This is an app with a default scene where you can test and experiment with Scenic core. For example, this is where most of the logic for FBX file animation exists while implementing support for it. Eventually this is will get renamed to playground.
2. Fileformat. This is meant to be loaded in a webworker to parsing Obj files. This can be easily extended to support parsing other file formats if needed.
3. Scenic. This is Scenic core - everything in `src`.
