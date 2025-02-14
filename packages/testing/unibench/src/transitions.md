# Transitions between languages

- always produce a collection
- if the collection elements are dictionaries of size 1:
  - `a JOIN (LANG b)`: the dict must remain as is
  - `ARRAY(LANG b)`: the dict should be replaced by its only value
