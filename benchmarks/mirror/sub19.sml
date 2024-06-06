
datatype btree = Empty | Node of int * btree * btree

fun mirror t =
  case t of
    Empty => Empty
  | Node (a, s1, s2) => Node (a, mirror s2, mirror s1)

