
datatype btree = Empty | Node of int * btree * btree

fun mirror t =
  case t of
    Empty => Empty
  | Node (m, t1, t2) => Node (m, mirror t2, mirror t1)

