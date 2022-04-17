# scenic
Scene graph renderer. Early work in progress.

Scenic uses a configuraton first approach where you define the hierarcy of
nodes in your scene. You are also welcome to manually put together the
nodes in a scene yourself if that's what you prefer.

You can take at this sample scene rendering skinned animation in scenic editor,
which is an application that renders a scene.  [Scenic Editor](https://scenic-editor.herokuapp.com/editor/index.html)

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
