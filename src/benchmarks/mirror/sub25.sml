
datatype btree = Empty | Node of int * btree * btree

fun mirror t =
  case t of
    Empty => Empty
  | Node (v, l, r) => Node (v, mirror r, mirror l)

