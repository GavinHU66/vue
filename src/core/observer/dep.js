/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'
import config from '../config'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 */
// Dependency依赖的缩写
// Dep是一个发布者，负责收集依赖，当数据更新是去通知订阅者
export default class Dep {

  // 全剧唯一的订阅者对象
  // “唯一” 是因为只能同时计算个更新一个订阅者的值
  static target: ?Watcher;

  // 每个观察者对象的订阅者队列的id，唯一标识
  id: number;

  // 观察者对象的订阅者队列
  subs: Array<Watcher>;

  constructor () {
    this.id = uid++ // 每次递增
    this.subs = []
  }

  /**
   * 添加订阅者watcher
   * @param {Object} sub Watcher实例
   */
  addSub (sub: Watcher) {
    this.subs.push(sub)
  }

  /**
   * 移除订阅者watcher
   * @param {Object} sub Watcher实例
   */
  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }

  /**
   * 通过watcher将自身添加到dep中
   */
  depend () {
    if (Dep.target) { // Dep.target 即为一个订阅者Watcher实例
      Dep.target.addDep(this) // 将自身作为参数传给 Watcher
    }
  }

  /**
   * 发布消息给所有订阅者watcher
   */
  notify () {
    // stabilize the subscriber list first
    const subs = this.subs.slice()
    if (process.env.NODE_ENV !== 'production' && !config.async) {
      // subs aren't sorted in scheduler if not running async
      // we need to sort them now to make sure they fire in correct
      // order
      subs.sort((a, b) => a.id - b.id)
    }
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

// The current target watcher being evaluated.
// This is globally unique because only one watcher
// can be evaluated at a time.
Dep.target = null
const targetStack = []

export function pushTarget (target: ?Watcher) {
  targetStack.push(target)
  Dep.target = target
}

export function popTarget () {
  targetStack.pop()
  Dep.target = targetStack[targetStack.length - 1]
}
