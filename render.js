/* global CustomEvent */

/**
 * @typedef Vnode
 * @prop {String} nodeName
 * @prop {String} [data]
 * @prop {Object<[String], [String | Boolean]>} attributes
 * @prop {(ChildNodes|ChildNodes[])} childNodes
 * @prop {Boolean} [booted]
 * @prop {ChildNodes} [result]
 */

/**
 * @typedef {(ChildNodes[]|ChildNodes|Vnode|Function|String|Boolean|Number|SkruvIterableType|SkruvIterableType)[]} ChildNodes
 */

/**
 * @typedef {Object} SkruvAdditionalProperties
 * @property {Set<Vnode>} [skruvActiveAttributeGenerators]
 * @property {Set<SkruvIterableType>} [skruvActiveGenerators]
 * @property {Object<[String], Function>} [skruvListeners]
 * @property {String} [data]
 * @property {Function} [append]
 * @property {Function} [removeAttribute]
 * @property {Function} [getAttribute]
 * @property {Function} [setAttribute]
 *
 * @typedef {Node & SkruvAdditionalProperties} SkruvDomType
 */

/**
 * @typedef {Object} SkruvAdditionalIterableProperties
 * @property {ChildNodes} [result]
 * @property {Boolean} [booted]
 *
 * @typedef {(AsyncGenerator<any, ChildNodes> | AsyncIterable<ChildNodes>) & SkruvAdditionalIterableProperties} SkruvIterableType
 */

/**
 * Update the attributes on a node
 * @param {Vnode} vNode
 * @param {SkruvDomType} node
 */
const updateAttributes = (vNode, node) => {
  node.skruvActiveAttributeGenerators = new Set()
  for (const [key, value] of Object.entries(vNode.attributes)) {
    // Node keys do not get added to the DOM
    if (key === 'key' || key === 'opaque') continue
    // @ts-ignore
    if (vNode?.[Symbol.asyncIterator] || (vNode instanceof Function && vNode?.prototype?.toString?.() === '[object AsyncGenerator]')) {
      node.skruvActiveAttributeGenerators.add(vNode)
      if (!value.booted) {
        value.booted = true
        const rerender = () => {
          // If this generator did not participate in the last renderloop cancel it. It means that it should no longer be allowed to update the parent
          if (!node.skruvActiveAttributeGenerators?.has(vNode)) return false
          if (value.result === false && node.getAttribute?.(key)) {
            node.removeAttribute && node.removeAttribute(key)
          } else {
            if (key === 'value' || key === 'checked' || key === 'selected') {
              // @ts-ignore
              node[key] = value.result
            }
            node.setAttribute && node.setAttribute(key, value.result)
          }
          return true
        }
        updateOnChange(value, rerender)
      }
      return vNode.result
    } else if (key.slice(0, 2) === 'on' && value instanceof Function) {
      if (!node.skruvListeners) {
        node.skruvListeners = {}
      }
      if (node.skruvListeners[key] && node.skruvListeners[key].toString() !== value.toString()) {
        node.removeEventListener(key.slice(2), node.skruvListeners[key])
        node.skruvListeners[key] = null
      }
      if (!node.skruvListeners[key]) {
        node.skruvListeners[key] = value
        node.addEventListener(key.slice(2), node.skruvListeners[key])
      }
    } else {
      if (value !== false && node.getAttribute?.(key) !== value) {
        // These need to be set directly to have the desired effect.
        if (key === 'value' || key === 'checked' || key === 'selected') {
          // @ts-ignore
          node[key] = value
        }
        node.setAttribute && node.setAttribute(key, value)
      }
      if (value === false && node.getAttribute?.(key)) {
        node.removeAttribute && node.removeAttribute(key)
      }
    }
  }
}

/**
 * @param {Vnode} vNode
 * @param {Boolean} isSvg
 * @returns {HTMLElement | SVGElement | Text | Comment}
 */
const createNode = (vNode, isSvg) => {
  if (vNode.nodeName === '#comment') {
    return document.createComment(vNode.data || '')
  }
  if (vNode.nodeName === '#text') {
    return document.createTextNode(vNode.data || '')
  }
  if (isSvg) {
    return document.createElementNS('http://www.w3.org/2000/svg', vNode.nodeName)
  }
  return document.createElement(vNode.nodeName)
}

/**
 * @param {SkruvIterableType} gen
 * @param {Function} rerender
 */
const updateOnChange = async (gen, rerender) => {
  // @ts-ignore
  for await (const result of (gen?.[Symbol.asyncIterator] ? gen : gen())) {
    gen.result = result
    if (!rerender()) break
  }
}

/**
 * @param {ChildNodes} vNodeArray
 * @param {SkruvDomType} parent
 * @param {Boolean} isSvg
 * @returns {Array<Vnode>}
 */
const sanitizeTypes = (vNodeArray, parent, isSvg, actualVNodeArray = vNodeArray) => {
  const retVal = vNodeArray.map((vNode) => {
    if (typeof vNode === 'boolean' || typeof vNode === 'undefined') {
      return false
    } else if (typeof vNode === 'string' || typeof vNode === 'number') {
      return {
        nodeName: '#text',
        attributes: {},
        childNodes: [],
        data: vNode.toString()
      }
    // @ts-ignore
    } else if (vNode?.[Symbol.asyncIterator] || (vNode instanceof Function && vNode?.prototype?.toString?.() === '[object AsyncGenerator]')) {
      /** @type {SkruvIterableType} */
      // @ts-ignore
      const vNodeIterator = vNode
      parent.skruvActiveGenerators && parent.skruvActiveGenerators.add(vNodeIterator)
      if (!vNodeIterator.booted) {
        vNodeIterator.booted = true
        const rerender = () => {
          // If this generator did not participate in the last renderloop cancel it. It means that it should no longer be allowed to update the parent
          if (!parent.skruvActiveGenerators || (parent.skruvActiveGenerators && !parent.skruvActiveGenerators.has(vNodeIterator))) return false
          renderArray(actualVNodeArray, parent, isSvg)
          return true
        }
        updateOnChange(vNodeIterator, rerender)
      }
      return vNodeIterator.result
    } else if (typeof vNode === 'function') {
      return vNode()
    // @ts-ignore
    } else if (vNode?.nodeName || Array.isArray(vNode)) {
      return vNode
    }
    // Unkown type passed
    console.log('unkown type in render: ', vNode)
    return false
  }).flat(Infinity).filter(vNode => !!vNode)

  // Handle results from generators returning generators, functions returning functions, etc.
  return retVal.find(vNode => !vNode?.nodeName) ? sanitizeTypes(retVal, parent, isSvg, actualVNodeArray) : retVal
}

/**
 * @param {ChildNodes} vNodeArray
 * @param {SkruvDomType} parent
 * @param {Boolean} isSvg
 */
const renderArray = (vNodeArray, parent, isSvg) => {
  if (!Array.isArray(vNodeArray)) return
  parent.skruvActiveGenerators = new Set()
  const nodes = Array.from(parent.childNodes)
  const newNodes = sanitizeTypes(vNodeArray, parent, isSvg)
  nodes.slice(newNodes.length).forEach(elem => {
    elem.parentNode && elem.parentNode.removeChild && elem.parentNode.removeChild(elem)
    elem.dispatchEvent(new CustomEvent('remove'))
  })
  newNodes.forEach((vNode, index) => {
    const node = nodes[index]
    renderSingle(vNode, node, parent, isSvg)
  })
}

/**
 * @param {Vnode} vNode
 * @param {SkruvDomType} _node
 * @param {SkruvDomType} parent
 * @param {Boolean} isSvg
 */
const renderSingle = (vNode, _node, parent, isSvg) => {
  if (!vNode.nodeName) {
    return
  }
  // Create node if it does not exist
  let node
  if (!_node) {
    node = createNode(vNode, isSvg)
    parent.append && parent.append(node)
    vNode.attributes?.oncreate && vNode.attributes.oncreate(node)
  } else if (_node.nodeName.toLowerCase() !== vNode.nodeName.toLowerCase()) {
    node = createNode(vNode, isSvg)
    parent.replaceChild(node, _node)
    _node.dispatchEvent(new CustomEvent('remove', {
      detail: {
        newNode: node
      }
    }))
  } else if (_node.data !== vNode.data) {
    _node.data = vNode.data
    node = _node
  } else {
    node = _node
  }
  // Diff node attributes
  // TODO: below this should only be done for SVG/HTML, not for Comment/Text
  updateAttributes(vNode, node)
  // Call renderArray with children
  if (!vNode?.attributes?.opaque && (vNode.childNodes.length || node.childNodes.length)) {
    renderArray(vNode.childNodes, node, isSvg)
  }
}

/**
 * @param {Vnode} vNode
 * @param {SkruvDomType} node
 * @param {SkruvDomType|null} parent
 * @param {Boolean} isSvg
 */
const render = (
  vNode,
  node = document.documentElement,
  parent = node.parentNode,
  isSvg = false,
  root = node
) => {
  if (!parent) {
    throw new Error('Skruv: No parent to render to')
  }
  // render the single first root node
  renderSingle(vNode, node, parent, isSvg)
}

export default render