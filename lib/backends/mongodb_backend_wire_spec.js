module.exports = {
  backend: {
    create: {
      module: './backends/mongodb_backend',
      isConstructor: true
    },
    properties: {
      mongodb: { $ref: 'mongodb' }
    }
  },
  mongodb: {
    module: 'mongodb'
  }
}
