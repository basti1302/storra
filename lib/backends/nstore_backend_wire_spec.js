module.exports = {
  backend: {
    create: {
      module: './backends/nstore_backend',
      isConstructor: true
    },
    properties: {
      fs:     { module: 'fs' },
      nStore: { module: 'nstore'},
      os:     { module: 'os' }
    }
  }
}
