
datatype btree = Empty | Node of int * btree * btree

fun mirror tree =
  case tree of
    Empty => tree
  | Node (a, t1, t2) =>
      if t1 = Empty then Node (a, mirror t2, Empty)
      else if t2 = Empty then Node (a, Empty, mirror t1)
      else Node (a, mirror t2, mirror t1)

