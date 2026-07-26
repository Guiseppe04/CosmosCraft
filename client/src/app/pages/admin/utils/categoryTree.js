export function buildCategoryTree(categories) {
  const map = new Map()
  const roots = []

  categories.forEach((category) => {
    map.set(category.category_id, { ...category, children: [] })
  })

  categories.forEach((category) => {
    const node = map.get(category.category_id)
    if (category.parent_id && map.has(category.parent_id)) {
      map.get(category.parent_id).children.push(node)
    } else {
      roots.push(node)
    }
  })

  const sortNodes = (nodes) => {
    nodes.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    nodes.forEach((node) => sortNodes(node.children))
  }

  sortNodes(roots)

  return roots
}

export function flattenCategoryTreeForAdmin(tree, depth = 0) {
  const result = []

  tree.forEach((node) => {
    result.push({ ...node, depth, isParent: node.children && node.children.length > 0 })
    if (node.children && node.children.length > 0) {
      result.push(...flattenCategoryTreeForAdmin(node.children, depth + 1))
    }
  })

  return result
}
