
datatype btree = Empty | Node of int * btree * btree

fun mirror t =
  case t of
    Empty => Empty
  | Node (n, l, r) => Node (n, mirror r, mirror l)

