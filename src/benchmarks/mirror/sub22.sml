
datatype btree = Empty | Node of int * btree * btree

fun mirror tree =
  case tree of
    Node (i, t1, t2) => Node (i, mirror t2, mirror t1)
  | Empty => Empty

