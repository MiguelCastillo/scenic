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

  load(file) {
    const match = file.match(/(?:\.(\w+))$/);

    if (!match) {
      throw new Error("File didn't have an extension");
    }

    const [, fileExtension] = match;

    if (!this.loaders.hasOwnProperty(fileExtension)) {
      throw new Error(`Loader for file extension "${fileExtension}" not registered`);
    }

    return this.loaders[fileExtension](file);
  }

  loadMany(files) {
    return Promise.all(files.map(file => this.load(file)));
  }
}
