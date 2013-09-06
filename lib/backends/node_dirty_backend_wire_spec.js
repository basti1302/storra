module.exports = {
  backend: {
    create: {
      module: './backends/node_dirty_backend',
      isConstructor: true,
    },
    properties: {
      fs:    { module: 'fs'    },
      dirty: { module: 'dirty' },
      os:    { module: 'os'    },
    }
  }
}
