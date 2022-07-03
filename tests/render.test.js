/* global test expect */
import render from '../render.js'
import { body } from '../html.js'

test('simple render', async () => {
  const html = document.createElement('html')
  const root = document.createElement('body')
  html.appendChild(root)
  render(body({}, 'test'), root)
  expect(html.childNodes[0].textContent).toBe('test')
})
