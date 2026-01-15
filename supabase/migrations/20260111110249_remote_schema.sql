drop extension if exists "pg_net";

revoke delete on table "public"."messages" from "anon";

revoke insert on table "public"."messages" from "anon";

revoke references on table "public"."messages" from "anon";

revoke select on table "public"."messages" from "anon";

revoke trigger on table "public"."messages" from "anon";

revoke truncate on table "public"."messages" from "anon";

revoke update on table "public"."messages" from "anon";

revoke delete on table "public"."messages" from "authenticated";

revoke insert on table "public"."messages" from "authenticated";

revoke references on table "public"."messages" from "authenticated";

revoke select on table "public"."messages" from "authenticated";

revoke trigger on table "public"."messages" from "authenticated";

revoke truncate on table "public"."messages" from "authenticated";

revoke update on table "public"."messages" from "authenticated";

revoke delete on table "public"."messages" from "service_role";

revoke insert on table "public"."messages" from "service_role";

revoke references on table "public"."messages" from "service_role";

revoke select on table "public"."messages" from "service_role";

revoke trigger on table "public"."messages" from "service_role";

revoke truncate on table "public"."messages" from "service_role";

revoke update on table "public"."messages" from "service_role";

revoke delete on table "public"."threads" from "anon";

revoke insert on table "public"."threads" from "anon";

revoke references on table "public"."threads" from "anon";

revoke select on table "public"."threads" from "anon";

revoke trigger on table "public"."threads" from "anon";

revoke truncate on table "public"."threads" from "anon";

revoke update on table "public"."threads" from "anon";

revoke delete on table "public"."threads" from "authenticated";

revoke insert on table "public"."threads" from "authenticated";

revoke references on table "public"."threads" from "authenticated";

revoke select on table "public"."threads" from "authenticated";

revoke trigger on table "public"."threads" from "authenticated";

revoke truncate on table "public"."threads" from "authenticated";

revoke update on table "public"."threads" from "authenticated";

revoke delete on table "public"."threads" from "service_role";

revoke insert on table "public"."threads" from "service_role";

revoke references on table "public"."threads" from "service_role";

revoke select on table "public"."threads" from "service_role";

revoke trigger on table "public"."threads" from "service_role";

revoke truncate on table "public"."threads" from "service_role";

revoke update on table "public"."threads" from "service_role";

alter table "public"."messages" drop constraint "messages_thread_id_fkey";

alter table "public"."messages" drop constraint "messages_pkey";

alter table "public"."threads" drop constraint "threads_pkey";

drop index if exists "public"."idx_messages_thread_id";

drop index if exists "public"."idx_messages_user_id";

drop index if exists "public"."idx_threads_user_id";

drop index if exists "public"."messages_pkey";

drop index if exists "public"."threads_pkey";

drop table "public"."messages";

drop table "public"."threads";


