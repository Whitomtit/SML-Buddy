
datatype btree = Empty | Node of int * btree * btree

exception Failure of string

fun mirror t =
  case t of
    Empty => Empty
  | Node (v, t1, t2) =>
      if t1 = Empty then
        (if t2 = Empty then Node (v, Empty, Empty)
        else Node (v, mirror t2, Empty))
      else if t2 = Empty then
        Node (v, Empty, mirror t1)
      else Node (v, mirror t2, mirror t1)

