import { renderNode } from 'https://unpkg.com/skruv@0.0.7-1/vDOM.js'
import { body, h1, progress, div } from 'https://unpkg.com/skruv@0.0.7-1/html.js'
import { createState } from 'https://unpkg.com/skruv@0.0.7-1/state.js'
import { importer } from 'https://unpkg.com/skruv@0.0.7-1/utils/importer.js'

let root = document.body

export let state = {
  input: 'Global',
  error: false
}

/* Normalize the url so it is not relative to the importer */
const importUrl = (url) => (new URL(url, import.meta.url)).href

const err = (err) => { state.error = err; console.error(err) }

export const render = () => {
  root = renderNode(body({},
    state.error ? div({ class: 'error' }, 'Error!') : [
      h1({}, state.input),
      importer(importUrl('./components/one.js'), { success: render, error: err }, 'one') || progress()
    ]
  ), root)
}

state = createState(state, render)

render()