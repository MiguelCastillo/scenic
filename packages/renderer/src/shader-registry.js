// ShaderRegistry decides which shader each kind of object draws with, and
// creates the shader programs for them. Code that defines a kind of object,
// such as a scene node type, registers its shader next to it, so the choice
// lives with the type but is made in one place.
//
// A registration maps a class to a shader name, or to a function that picks
// one for a particular object, or returns null when the object draws nothing
// and needs no shader program. An object uses the registration of its most
// specific class, so a subclass can register its own shader over its parent's.
//
// createShaderProgram(gl, name) returns a promise of the ShaderProgram for a
// shader name. Loading shader sources is up to it, since where they live
// depends on the app.
export class ShaderRegistry {
  constructor(createShaderProgram) {
    this.createShaderProgram = createShaderProgram;
    this.registrations = new Map();
  }

  // register sets the shader for objects of Type and its subclasses, unless a
  // subclass registers its own.
  register(Type, shader) {
    this.registrations.set(Type, shader);
    return this;
  }

  // shaderFor returns the name of the shader object draws with, or null when
  // it needs none.
  shaderFor(object) {
    for (let proto = Object.getPrototypeOf(object); proto; proto = Object.getPrototypeOf(proto)) {
      if (this.registrations.has(proto.constructor)) {
        const shader = this.registrations.get(proto.constructor);
        return typeof shader === "function" ? shader(object) : shader;
      }
    }
    return null;
  }

  // applyShaders gives each object that has no shader program the one
  // shaderFor picks for it. Objects hold their program as `shaderProgram` and
  // take one with `withShaderProgram(program)`, the way scene renderables do.
  //
  // isDisposed reports whether the objects were disposed while their shaders
  // loaded. A program created after that, or for an object that got a program
  // in the meantime, is deleted instead, because nothing else would delete it.
  applyShaders(gl, objects, isDisposed) {
    return Promise.all(
      objects
        .filter((object) => !object.shaderProgram)
        .map(async (object) => {
          const shader = this.shaderFor(object);
          if (!shader) {
            return;
          }

          const shaderProgram = await this.createShaderProgram(gl, shader);
          if (isDisposed() || object.shaderProgram) {
            shaderProgram.dispose();
            return;
          }
          object.withShaderProgram(shaderProgram);
        })
    );
  }
}
