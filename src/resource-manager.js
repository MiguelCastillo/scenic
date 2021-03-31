export class ResourceManager {
  constructor() {
    this.loaders = {};
  }

  register(fileExtension, loader) {
    if (this.loaders.hasOwnProperty(fileExtension)) {
      throw new Error(`Loader for file extension "${fileExtension}" is already regitered.`);
    }

    this.loaders[fileExtension] = loader;
    return this;
  }

  // Filename is a separate argument because a URL can be from a file selector
  // in which case the URL object will be a blob and a filename cannot be
  // derrived from it. We need a filename to be able to derrive the correct
  // file loader, which relies on the file extension. Blobs do not have
  // filenames with extensions, and that's a security feature. They looks like:
  // blob:http://localhost:3000/9f19dc8a-02fd-4554-99a0-8ee40151b4a1
  load(url, filename) {
    const match = filename.match(/(?:\.(\w+))$/);

    if (!match) {
      throw new Error("File didn't have an extension");
    }

    const [, fileExtension] = match;

    if (!this.loaders.hasOwnProperty(fileExtension)) {
      throw new Error(`Loader for file extension "${fileExtension}" not registered`);
    }

    return this.loaders[fileExtension](url);
  }

  loadMany(files) {
    return Promise.all(files.map(file => this.load(file)));
  }
}
