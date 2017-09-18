const ist = require("ist")
const {schema, doc, p} = require("prosemirror-test-builder")
const {Transform} = require("prosemirror-transform")

const {findEdits} = require("../src/find-edits")

describe("findEdits", () => {
  it("finds a single insertion",
     find(doc(p("he<a>llo")), (tr, p) => tr.insert(p("a"), schema.text("XY")), {a: 2}))

  it("finds a single deletion",
     find(doc(p("he<a>ll<b>o")), (tr, p) => tr.delete(p("a"), p("b")), null, {a: "ll"}))

  it("identifies a replacement",
     find(doc(p("he<a>ll<b>o")), (tr, p) => tr.replaceWith(p("a"), p("b"), schema.text("juj")), {a: 3}, {a: "ll"}))

  it("merges adjacent canceling edits",
     find(doc(p("he<a>ll<b>o")), (tr, p) => tr.delete(p("a"), p("b")).insert(p("a"), schema.text("ll"))))

  it("partially merges insert at start",
     find(doc(p("he<a>l<b>L<c>o")), (tr, p) => tr.delete(p("a"), p("c")).insert(p("a"), schema.text("l")), null, {4: "L"}))

  it("partially merges insert at end",
     find(doc(p("he<a>lL<b>o")), (tr, p) => tr.delete(p("a"), p("b")).insert(p("a"), schema.text("L")), null, {3: "l"}))

  it("partially merges delete at start",
     find(doc(p("ab<a>c")), (tr, p) => tr.insert(p("a"), schema.text("xyz")).delete(p("a"), p("a") + 1), {a: 2}))

  it("partially merges delete at end",
     find(doc(p("ab<a>c")), (tr, p) => tr.insert(p("a"), schema.text("xyz")).delete(p("a", 1) - 1, p("a", 1)), {3: 2}))

  it("finds multiple insertions",
     find(doc(p("<a>abc<b>")), (tr, p) => tr.insert(p("a"), schema.text("x")).insert(p("b"), schema.text("y")), {a: 1, b: 1}))

  it("finds multiple deletions",
     find(doc(p("<a>x<b>y<c>z<d>")), (tr, p) => tr.delete(p("a"), p("b")).delete(p("c"), p("d")), null, {a: "x", c: "z"}))

  it("identifies a deletion between insertions",
     find(doc(p("z<a>y<b>z")), (tr, p) => tr.insert(p("a"), schema.text("A")).insert(p("b"), schema.text("B")).delete(p("a", 1), p("b")),
          {a: 2}, {a: "y"}))
})

function find(doc, build, insertions, deletions, sep) {
  return () => {
    let tr = new Transform(doc)
    build(tr, (name, assoc) => tr.mapping.map(doc.tag[name], assoc || -1))

    let ids = []
    for (let i = 0; i < tr.steps.length; i++) ids.push(sep ? i : 0)
    let {deleted, inserted} = findEdits(doc, tr.doc, tr.steps, ids, (a, b) => a == b, a => a)

    let delKeys = Object.keys(deletions || {}), insKeys = Object.keys(insertions || {})
    ist(inserted.length, insKeys.length)
    ist(deleted.length, delKeys.length)

    insKeys.forEach((name, i) => {
      let pos = /\D/.test(name) ? tr.mapping.map(doc.tag[name], -1) : +name
      let {from, to} = inserted[i]
      ist(from, pos)
      ist(to, pos + insertions[name])
    })

    delKeys.forEach((name, i) => {
      let {pos, slice: {content}} = deleted[i]
      ist(pos, /\D/.test(name) ? tr.mapping.map(doc.tag[name], -1) : +name)
      ist(content.textBetween(0, content.size), deletions[name])
    })
  }
}