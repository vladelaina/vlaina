if (!document.elementFromPoint) {
  document.elementFromPoint = () => null
}

Object.defineProperty(Element.prototype, 'getClientRects', {
  value: function () {
    return {
      length: 0,
      item: () => null,
      [Symbol.iterator]: function* () {},
    }
  },
})

Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
  value: function () {
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      toJSON: () => ({}),
    }
  },
})

Object.defineProperty(Range.prototype, 'getClientRects', {
  value: function () {
    return {
      length: 0,
      item: () => null,
      [Symbol.iterator]: function* () {},
    }
  },
})

Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
  value: function () {
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      toJSON: () => ({}),
    }
  },
})

Object.defineProperty(Element.prototype, 'scrollIntoView', {
  value: function () {},
})
