const { AsyncResource } = require("async_hooks");
const uuid = require("uuid");
const ResourcePool = require("./resource-pool");

const pool = new ResourcePool();
const tasks = Symbol("@@tasks");
const id = Symbol("@@resource-id");

class Resource extends AsyncResource {
  static get now() {
    return pool.getCurrentResource();
  }

  static addTask(promise) {
    this.now.addTask(promise);
  }

  static make(...args) {
    return Reflect.construct(this, args);
  }

  static wrap(fn, ...resourceArgs) {
    return (...args) => {
      return this.make(...resourceArgs).run(() => fn(...args));
    };
  }

  constructor() {
    super("ASYNC_RESOURCE");
    this[id] = uuid();
    this[tasks] = [];
  }

  get id() {
    return this[id];
  }

  addTask(promise) {
    this[tasks].push(promise);
  }

  run(fn) {
    pool._register(this);
    return new Promise((resolve, reject) => {
      this.runInAsyncScope(() => {
        Promise.resolve()
          .then(fn)
          .then(() => Promise.all(this[tasks]))
          .then(() => null)
          .catch(e => e)
          .then(e => {
            this.emitDestroy();
            e ? reject(e) : resolve();
          });
      });
    });
  }
}

module.exports = Resource;
