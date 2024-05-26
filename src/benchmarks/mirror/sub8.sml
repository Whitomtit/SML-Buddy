
datatype btree = Empty | Node of int * btree * btree

fun mirror t =
  case t of
    Empty => Empty
  | Node (n, t1, t2) => Node (n, mirror t2, mirror t1)

