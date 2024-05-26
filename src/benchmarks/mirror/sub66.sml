
datatype btree = Empty | Node of int * btree * btree

fun mirror t =
  case t of
    Empty => Empty
  | Node (i, l, r) => Node (i, mirror r, mirror l)

