importScripts("/editor/dist/file-formats.js");

// Worker
onmessage = (evt) => {
  const file = evt.data.file;
  const invertDirection = evt.data.invertDirection;
  const timer = new fileformats.Timer();

  timer.start();
  fetch(file)
    .then((res) => {
      // eslint-disable-next-line
      console.log("Downloaded:", file, `${timer.elapsed()} seconds`);
      return res.text();
    })
    .then((t) => {
      timer.start();
      const obj = fileformats.ObjFile.create(t, invertDirection);
      // eslint-disable-next-line
      console.log("Parsed:", file, `${timer.elapsed()} seconds`);

      timer.start();
      const triangles = obj.getTriangles();
      // eslint-disable-next-line
      console.log("Triangulate:", file, `${timer.elapsed()} seconds`);

      // eslint-disable-next-line
      console.log(
        "Stats:",
        file,
        `\n vertices ${triangles.vertices.length}`,
        `\n normals ${triangles.normals.length}`,
        `\n textures ${triangles.textures.length}`
      );

      const buffers = {
        vertices: new Float32Array(triangles.vertices).buffer,
        normals: new Float32Array(triangles.normals).buffer,
        colors: new Float32Array(triangles.colors).buffer,
        textures: new Float32Array(triangles.textures).buffer,
      };

      postMessage(
        {file, model: buffers},
        // Buffers so that this worker can transfer ownership of the buffers
        // without duplicating data
        [buffers.vertices, buffers.normals, buffers.colors, buffers.textures]
      );
    });
};
