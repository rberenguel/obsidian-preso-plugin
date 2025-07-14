---
preso: ostrich
---


# Preso[^fn1]

[fn1]: An Obsidian plugin by [rberenguel](https://www.mostlymaths.net)

---

# What is preso[^getpreso]?

- Lightweight plugin to create presentations in `Markdown`  in [Obsidian](https://obsidian.md/)
- Inspired by the way [Deckset](https://www.deckset.com/) presentations are built
- Works in Obsidian **desktop** and obsidian **mobile**
- Can **export** presentations as `HTML+CSS+JS` or `HTML+CSS` only

[getpreso]: You can find the plugin [here](https://github.com/rberenguel/obsidian-preso-plugin)

---

# How does it work?

Slides are separated by a Markdown rule separator, three dashes `---` on its own line.

**Paragraphs?** Just type.

New lines between paragraphs? Just leave a line empty.

---
favicon: ![[rberenguel_shrug.png]]
slidenumbers: true
footer-image: ![[rberenguel_shrug.png]]
footer: I shrug a lot
top-left-icon: ![[fine.png]]
top-right-icon: ![[chuck-norris.png]]

# Nice things

You can add numbers to your slides

As well as a footer icon/image

And a footer proper.[^css] {css; width: 100%; text-align: right; color: lime ; text-shadow: 2px 2px 5px cyan;}

/---

They are enabled until they are not. And you can re-enable them later, too.

[css]: You can also override CSS per paragraph if you feel like you really need to. Sometimes you do

---

# 6 levels of headers

## Second

### Third

#### Fourth

##### Fifth

###### Sixth

---
slidenumbers: true
footer-image: ![[rberenguel_shrug.png]]
footer: I shrug a lot
top-left-icon: 
top-right-icon: 


# We have lists[^fn4]

- Unordered lists
- …

==And obviously==

1. ~~Un~~Ordered lists
2. …

[fn4]: And footnotes. I always forget the footnote syntax…

---

# We can show code

```python
squares = [x * x for x in range(1, 11)]
```

/---

```haskell
qsort [] = []
qsort (p:xs) = qsort (filter (< p) xs) ++ [p] ++ qsort (filter (>= p) xs)
```

/---

```cpp
std::vector<int> v = {4, 1, 3, 2};
std::sort(v.begin(), v.end(), [](int a, int b) { return a < b; });
```

---

#  And background images, with automated filter

![[underwater-sample-image.jpg|bg]]

---
slidenumbers: false
footer: 
footer-image:

#  We can override the filter, too

![[underwater-sample-image.jpg|bg blur(0) sepia(1)]]

---

![[bubbles-sample-image.jpg|left]]

# We can also have images on the _left_

---

![[bubbles-sample-image.jpg|right]]

# And on the _right_

---
slidenumbers: true
footer-image: ![[rberenguel_shrug.png]]
footer: I shrug a lot

![[bubbles-sample-image.jpg|bg blur(0)]]
![[flows-sample-image.jpg|bg]]
![[bubbles-sample-image.jpg|bg]]
![[flows-sample-image.jpg|bg]]

# Or have multiple as background, in _vertical slices_[^fn2]

[fn2]: With or without filter

---

You can add speaker notes

```any
 ^ This would be a speaker note (any line starting with a hat)
```

/---

You can see speaker notes in the exported slides, too

^ If you have tried to open the speaker notes slide you'll see it

---

# Export

### You can export to _standalone_[^standalone]

- `HTML+CSS+JS`

or

- `HTML+CSS` only[^fn3]

[standalone]: Images and fonts are inlined as `data` URLs
[fn3]: security!

---

# Presentation mode

1. Export to `HTML+CSS+JS`
2. Press `P` to open the presentation window ![[amaze.gif]]
3. Switch your slides to full screen
4. Enjoy having a view of the _previous slide_, _next slide_ and _speaker notes_ while you present
5. You can use your keyboard's `←` and `→` on the presenter view to advance

---

## Tips

- Writing slides is best in _source mode_, **not** on _live preview mode_. The plugin forces the editor to source mode when switching to a Preso and restores it when leaving.
- Some things depend on having / not having spaces between things. In case of doubt, try to do it like in this example slides 😏

---
slidenumbers: false
footer: 
footer-image:

# Enjoy!
