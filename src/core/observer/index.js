/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
// 观察者，使用 getter/setter方法覆盖默认的读写操作，把对象封装成响应式
export class Observer {

  // 原始值
  value: any;

  // 依赖的列表，装有依赖，即订阅者
  dep: Dep;
  vmCount: number; // number of vms that have this object as root $data

  constructor (value: any) {
    this.value = value
    
    // 每一个Observer（观察者）对象都有一个 Dep 实例，作为订阅管理器，管理此观察者的订阅者
    this.dep = new Dep()
    this.vmCount = 0

    // def 是 defineProperty 的简单封装:
    // 为 value 对象设置 '__ob__' 属性，修饰器属性为 this
    // 之后再调用时，就直接返回这个属性，即 value.__ob__ = this
    def(value, '__ob__', this)

    // 如果value是Array，那么调用observeArray对每一个元素进行observe方法处理
    // 并且对数组的7个变异方法（push、pop、shift、unshift、splice、sort、reverse）实现了响应式
    // 对数组进行了特殊处理，不会执行 walk，也就是不会对每一项实施监控
    // Vue 中是通过对每个键设置 getter/setter 来实现响应式的，开发者使用数组，目的往往是遍历，此时调用 getter 开销太大了，
    // 所以 Vue 不在数组每个键上设置，跳过了对数组每个键设置响应式的过程，而是对值进行递归设置响应式
    if (Array.isArray(value)) {

      // this.walkArr(value)
      if (hasProto) {
        // protoAugment 使用原型链继承 
        // 即：value.__proto__ = arrayMethods
        protoAugment(value, arrayMethods)
      } else {
        // copyAugment 使用原型链定义，对于每一个数组进行 defineProperty，相当于一个深拷贝
        copyAugment(value, arrayMethods, arrayKeys)
      }
      this.observeArray(value)

    } else {
      // 如果value是对象/基本类型，那么调用walk对每一个属性进行defineReactive方法处理
      this.walk(value)
    }
  }

  walkArr(arr: Array) {
    arr.forEach((item, index) => {
      defineReactive(arr, index)
    })
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment (target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
// 将数据设置成响应式的（设置getter/setter）
// 为 value 创建一个 Observer 观察者实例，或返回 value 已有 Observer 观察者实例
export function observe (value: any, asRootData: ?boolean): Observer | void {
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob: Observer | void

  // 返回 value 已有 Observer 观察者实例
  // 如果value已有Observer实例，则直接返回此实例，这个Observer实例储存在 __ob__ 中
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } 


  // 为 value 创建一个 Observer 观察者实例
  // 如果value还没有Observer实例，则为value建立一个观察者Observer实例
  
  // 排除非单纯的对象，例如Regexp/vm实例/不可拓展的
  else if ( 
    shouldObserve &&
    !isServerRendering() && // 如果不是服务器渲染
    (Array.isArray(value) || isPlainObject(value)) && // 如果是对象Object或者数组Array
    Object.isExtensible(value) && // 如果是可拓展的
    !value._isVue
  ) {
    ob = new Observer(value) // 为value建立一个观察者Observer实例
  }
  if (asRootData && ob) {
    ob.vmCount++
  }

  // 返回Observer实例
  return ob
}

/**
 * Define a reactive property on an Object.
 */
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  const dep = new Dep()

  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  const getter = property && property.get
  const setter = property && property.set
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }

  // observe(val) 而非 observe(val, true)：asRootData 为 false
  let childOb = !shallow && observe(val)

  // 覆盖 get/set
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,

    // get：添加 watcher (即Dep.target) 到 dep
    get: function reactiveGetter () {
      const value = getter ? getter.call(obj) : val

      // 响应式：getter中将 Dep.target（一个订阅者Watcher）添加至 dep.subs中
      // 第一次运行的时候还没有 Dep.target，在编译模版的时候，实例化一个订阅者Watcher时，会设置 Dep.target，并触发以下操作
      if (Dep.target) {
        dep.depend() // dep.depend() -> Dep: Dep.target.addDep(this) -> Watcher: dep.addSub(this) -> Dep: this.subs.push(sub)
        if (childOb) { // 如果属性是Object对象则继续收集依赖
          childOb.dep.depend()
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },

    // set：通知 dep 中的所有订阅者
    set: function reactiveSetter (newVal) {
      console.log('set', newVal);
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter
      if (getter && !setter) return
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      childOb = !shallow && observe(newVal)

      // 每次get都通知 dep 中的所有订阅者
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set (target: Array<any> | Object, key: any, val: any): any {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  if (!ob) {
    target[key] = val
    return val
  }
  defineReactive(ob.value, key, val)
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del (target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
