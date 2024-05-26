
datatype btree = Empty | Node of int * btree * btree

fun mirror t =
  case t of
    Empty => Empty
  | Node (a, l, r) => Node (a, mirror r, mirror l)

