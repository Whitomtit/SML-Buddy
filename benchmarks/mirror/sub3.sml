
datatype btree = Empty | Node of int * btree * btree

fun mirror t =
  case t of
    Empty => Empty
  | Node (x, l, r) => Node (x, mirror r, mirror l)

