import { ul, li } from 'https://unpkg.com/skruv@0.2.0/html.js'

import Link from './Link.js'

export default () => ul({},
  li({}, Link({ href: '/examples/routing/page1' }, 'Page 1')),
  li({}, Link({ href: '/examples/routing/page2/exampleUser' }, 'Page 2')),
  li({}, Link({ href: '/examples/routing/page3' }, 'Non-existent page'))
)
