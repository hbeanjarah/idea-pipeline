--
-- PostgreSQL database dump
--

\restrict JdhQFVzQ27KAHyZH84bKiFaXAcCGagdfV9xGvqxdXc85ezAuQLxhPhMb8n0Mqrp

-- Dumped from database version 17.11 (Debian 17.11-1.pgdg13+2)
-- Dumped by pg_dump version 17.11 (Debian 17.11-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ideas; Type: TABLE; Schema: public; Owner: idea
--

CREATE TABLE public.ideas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    status text DEFAULT 'captured'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid NOT NULL,
    CONSTRAINT ideas_status_check CHECK ((status = ANY (ARRAY['captured'::text, 'maturing'::text, 'ready'::text, 'published'::text])))
);


ALTER TABLE public.ideas OWNER TO idea;

--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: idea
--

CREATE TABLE public.schema_migrations (
    name text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.schema_migrations OWNER TO idea;

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: idea
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


ALTER TABLE public.sessions OWNER TO idea;

--
-- Name: users; Type: TABLE; Schema: public; Owner: idea
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    google_sub text NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO idea;

--
-- Name: variations; Type: TABLE; Schema: public; Owner: idea
--

CREATE TABLE public.variations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    idea_id uuid NOT NULL,
    "position" integer NOT NULL,
    text text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT variations_text_check CHECK ((btrim(text) <> ''::text))
);


ALTER TABLE public.variations OWNER TO idea;

--
-- Data for Name: ideas; Type: TABLE DATA; Schema: public; Owner: idea
--

COPY public.ideas (id, status, created_at, updated_at, user_id) FROM stdin;
113ef68e-5641-4797-90ea-28f1997a2460	captured	2026-06-23 04:41:09.837+00	2026-06-23 18:03:55.853+00	d9113e39-d7b7-478e-a6ea-17a4843eccae
77e0716a-db38-44db-bcfd-2db980ab4bbe	captured	2026-06-23 04:41:43.48+00	2026-06-23 18:34:52.726+00	d9113e39-d7b7-478e-a6ea-17a4843eccae
15accf31-f2c4-4db1-b2c3-b1c3fc95fe07	published	2026-06-23 04:42:37.827+00	2026-07-17 12:06:18.928+00	d9113e39-d7b7-478e-a6ea-17a4843eccae
c99af203-0eaa-493a-9d49-96dab4f19581	published	2026-06-23 18:29:40.459+00	2026-07-17 12:06:34.194+00	d9113e39-d7b7-478e-a6ea-17a4843eccae
32374981-09af-4bad-980a-ca2db0a6cbc7	captured	2026-06-23 18:29:53.708+00	2026-06-23 18:29:53.708+00	d9113e39-d7b7-478e-a6ea-17a4843eccae
6e89d787-0ef5-479f-9a95-3c7e6cedfe1f	captured	2026-06-23 18:30:12.693+00	2026-06-23 18:30:12.693+00	d9113e39-d7b7-478e-a6ea-17a4843eccae
21337375-793c-4945-a635-2b109d311a48	captured	2026-06-23 18:30:30.575+00	2026-06-23 18:31:19.502+00	d9113e39-d7b7-478e-a6ea-17a4843eccae
5c7fb0da-cb0f-4fde-925f-eab2c24aef2f	captured	2026-06-23 18:30:35.58+00	2026-06-23 18:30:35.58+00	d9113e39-d7b7-478e-a6ea-17a4843eccae
eed710ff-1adf-4de3-980a-a793aadd4d4e	captured	2026-06-23 18:30:45.211+00	2026-06-23 18:30:45.211+00	d9113e39-d7b7-478e-a6ea-17a4843eccae
37acbb91-fa9c-4ce2-a40d-86af7cd90dd2	captured	2026-06-23 18:30:52.311+00	2026-06-23 18:30:52.311+00	d9113e39-d7b7-478e-a6ea-17a4843eccae
9d593844-1756-46cf-8fd5-e388c10c03e1	captured	2026-06-25 03:55:04.192+00	2026-06-25 03:55:04.192+00	d9113e39-d7b7-478e-a6ea-17a4843eccae
5c6c75a2-9b9b-462a-983f-3ad74f664470	captured	2026-07-08 02:45:30.79+00	2026-07-08 02:45:30.79+00	d9113e39-d7b7-478e-a6ea-17a4843eccae
3cc3d37d-2fe3-4544-80f2-31095f6a17c0	published	2026-07-16 08:48:58.721+00	2026-07-17 06:31:23.123+00	d9113e39-d7b7-478e-a6ea-17a4843eccae
17fbe6a5-5604-4036-8d27-ee82720583df	captured	2026-07-17 06:31:16.173+00	2026-07-17 06:31:16.173+00	d9113e39-d7b7-478e-a6ea-17a4843eccae
a0314954-bc23-43f9-b9ee-e9dc4bdc30b2	captured	2026-07-17 11:40:19.043+00	2026-07-17 11:40:19.043+00	d9113e39-d7b7-478e-a6ea-17a4843eccae
be304cab-abdd-4763-a9b9-7264808a5cff	captured	2026-07-18 13:51:24.129+00	2026-07-18 13:51:24.129+00	d9113e39-d7b7-478e-a6ea-17a4843eccae
184b2308-0deb-4086-8f52-acd2e8e2d9fa	captured	2026-07-19 04:21:54.497+00	2026-07-19 04:22:57.11+00	d9113e39-d7b7-478e-a6ea-17a4843eccae
90be250a-17f4-4a6d-96cb-33d39ec5179f	published	2026-07-28 03:15:08.954+00	2026-07-28 06:19:10.238+00	d9113e39-d7b7-478e-a6ea-17a4843eccae
9f0d1496-e085-4a93-85eb-852377dc66e4	published	2026-07-30 03:55:29.471+00	2026-07-30 03:55:34.422+00	d9113e39-d7b7-478e-a6ea-17a4843eccae
d1421f41-71ea-436f-adf9-eff7e88497b7	captured	2026-07-30 03:55:47.044+00	2026-07-30 03:55:47.044+00	d9113e39-d7b7-478e-a6ea-17a4843eccae
0f27694c-f266-4ca7-ad98-05fc04317e8b	captured	2026-07-30 03:55:51.904+00	2026-07-30 03:55:51.904+00	d9113e39-d7b7-478e-a6ea-17a4843eccae
c56dec00-a77e-43e5-ac07-e7647560eb27	captured	2026-07-30 03:55:56.685+00	2026-07-30 03:55:56.685+00	d9113e39-d7b7-478e-a6ea-17a4843eccae
b3ccea44-bf82-4187-ad2c-49b01b9ca768	captured	2026-07-30 03:56:03.558+00	2026-07-30 03:56:03.558+00	d9113e39-d7b7-478e-a6ea-17a4843eccae
e8174b3a-6bfc-428d-9501-9e2127757fbc	captured	2026-07-31 02:33:14.845+00	2026-07-31 02:33:14.845+00	d9113e39-d7b7-478e-a6ea-17a4843eccae
b0e1e8c5-38fd-475c-b237-4ba71f53b928	captured	2026-07-31 02:34:08.159+00	2026-07-31 02:34:08.159+00	d9113e39-d7b7-478e-a6ea-17a4843eccae
b68e4955-ffff-4070-a090-a8f29cf01ecf	captured	2026-07-31 03:43:26.823+00	2026-07-31 03:43:26.823+00	d9113e39-d7b7-478e-a6ea-17a4843eccae
344f2617-bce2-405e-b9b4-b0793846c5c5	captured	2026-09-17 09:17:21.689875+00	2026-09-17 09:17:21.689875+00	d9113e39-d7b7-478e-a6ea-17a4843eccae
bfa9c720-bd88-469e-abdb-c3cc1786c731	captured	2026-08-02 07:01:32.466+00	2026-09-17 12:42:48.190079+00	d9113e39-d7b7-478e-a6ea-17a4843eccae
1810cdb0-0505-4834-a07e-2f6e17077624	captured	2026-07-30 04:01:57.324+00	2026-09-17 13:15:58.390752+00	d9113e39-d7b7-478e-a6ea-17a4843eccae
27e08aaf-576a-4d63-86da-1f529b2361a9	captured	2026-09-18 05:50:09.857816+00	2026-09-18 05:50:47.066934+00	d9113e39-d7b7-478e-a6ea-17a4843eccae
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: idea
--

COPY public.schema_migrations (name, applied_at) FROM stdin;
001_initial.sql	2026-09-13 09:25:19.82737+00
002_auth.sql	2026-09-14 12:04:06.563063+00
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: idea
--

COPY public.sessions (id, user_id, token_hash, user_agent, created_at, last_seen_at, expires_at) FROM stdin;
5b3826a3-27e2-4f07-a57e-e6c8735347f0	d9113e39-d7b7-478e-a6ea-17a4843eccae	01e393c831df574b9a11aa8b781f7a5eb9fbd713a6095cdf3f1e7f493d1dae7f	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36	2026-09-14 15:28:21.634241+00	2026-09-14 15:28:21.662795+00	2026-10-14 15:28:21.634241+00
8f63da25-d4d3-4d3d-9bfb-ddc8cf8f9720	d9113e39-d7b7-478e-a6ea-17a4843eccae	ae5f63bf0fc18d466a352b34d4074897943f3835682b64895122aaa488e32f5c	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36	2026-09-14 15:37:56.708866+00	2026-09-14 15:37:56.75199+00	2026-10-14 15:37:56.708866+00
1065b219-4c72-45b2-a6f6-1e2201e65769	d9113e39-d7b7-478e-a6ea-17a4843eccae	d16af0976b2b86c080a0188d51ddefeeea5c2ce6e0a968701ed5a21f1426e405	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	2026-09-17 13:06:39.470077+00	2026-09-17 13:11:46.289627+00	2026-10-17 13:06:39.470077+00
0fa02df2-bfce-4285-b4f2-ede4c4c9639f	d9113e39-d7b7-478e-a6ea-17a4843eccae	a7554dfdc7b639b25bbdc1f760eb8f835e40e3e0d0cc22d0c3d02971ffd6d1d3	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	2026-09-17 09:17:06.94215+00	2026-09-17 10:23:53.949321+00	2026-10-17 09:17:06.94215+00
6786e70c-cbf8-4b88-9bf6-1c1d4ce97f0f	d9113e39-d7b7-478e-a6ea-17a4843eccae	31d9e2051998caf6d2475bfdd0fad9408131779d534dfd2b9744a6c35159f87f	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	2026-09-17 10:39:52.369514+00	2026-09-17 10:39:52.783537+00	2026-10-17 10:39:52.369514+00
1895fab4-6133-4f95-b748-63306ed073b5	d9113e39-d7b7-478e-a6ea-17a4843eccae	1d363a4b6053398e98cbe04429e36b2edf47e181a42654496661ceec79fbc9e6	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	2026-09-17 13:15:11.245261+00	2026-09-17 13:15:58.3883+00	2026-10-17 13:15:11.245261+00
b4812cbc-b512-4c50-8975-83f486a1f7dd	d9113e39-d7b7-478e-a6ea-17a4843eccae	5b67399c6be31d94961df6db075e3a81a1a5441f7a27ebfbc515a2b943086809	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	2026-09-17 12:42:25.171469+00	2026-09-17 12:43:18.975869+00	2026-10-17 12:42:25.171469+00
eb32267f-ea83-4be1-ba81-9596dd8e5370	d9113e39-d7b7-478e-a6ea-17a4843eccae	90260c8c3ecb4bb832b589461e3b0426e5161c72fc9e3647a58a200099b0a3fd	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	2026-09-17 12:54:42.097911+00	2026-09-17 12:54:42.375261+00	2026-10-17 12:54:42.097911+00
0a97c916-47e7-4c8c-9068-6c97cdc6b96b	d9113e39-d7b7-478e-a6ea-17a4843eccae	86ec423d3978f0a7fd300aaeb8d197ee0c1556114b7ac3fbeb10245b0019db27	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	2026-09-17 12:57:09.859257+00	2026-09-17 12:57:10.140889+00	2026-10-17 12:57:09.859257+00
a08cbf08-f5ec-40db-bf88-b57b218aa7d2	d9113e39-d7b7-478e-a6ea-17a4843eccae	b02815b41d1be30774c2c47b0d0cfc00139ab1c8740f072dbd4675fcf34837a7	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	2026-09-18 05:43:22.281967+00	2026-09-18 06:48:21.243405+00	2026-10-18 05:43:22.281967+00
97f0c54d-a65f-4737-81a0-360e0fa4f30f	d9113e39-d7b7-478e-a6ea-17a4843eccae	c9c24198edbd37b5ac782d6c2d5f203986084d532f6881fb69f846fc96c5acd3	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	2026-09-18 10:58:59.901847+00	2026-09-18 10:59:00.22543+00	2026-10-18 10:58:59.901847+00
c6995d53-d22d-45f9-8b22-0676df5d90e5	d9113e39-d7b7-478e-a6ea-17a4843eccae	eca3ff2463e8568e3a742df8e255bcc146d26a1b11216816cb07de326292e3c6	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	2026-09-18 11:43:36.376565+00	2026-09-18 11:43:36.732214+00	2026-10-18 11:43:36.376565+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: idea
--

COPY public.users (id, google_sub, email, created_at) FROM stdin;
d9113e39-d7b7-478e-a6ea-17a4843eccae	110673361661354166754	hbeanjarahoussen@gmail.com	2026-09-14 15:22:56.593546+00
\.


--
-- Data for Name: variations; Type: TABLE DATA; Schema: public; Owner: idea
--

COPY public.variations (id, idea_id, "position", text, created_at) FROM stdin;
6f61a3f9-f56b-4eba-9398-5471e9856933	bfa9c720-bd88-469e-abdb-c3cc1786c731	1	v1.BivxbH+VrTOG7o/7gnkzlraSYVyXudwB6TeWN2AwuiA44XtBH7EFOSVrY9u/MF32IMwRRnC4yNPKUwq9+MIl2eX8jqExtnjI+2cw	2026-08-02 07:01:32.466+00
0197258a-da17-4230-96f6-aa7622fc4f78	b0e1e8c5-38fd-475c-b237-4ba71f53b928	1	v1.BtytjrzGclt4suzIyq0B1LBaDl7NGya4jUm18+XRuW/iPpQtoIyeRb42	2026-07-31 02:34:08.159+00
092415d8-62ea-41e2-841c-3f285952b0aa	344f2617-bce2-405e-b9b4-b0793846c5c5	1	v1.AAD5Kry2fBzdWxjUT1hqn0gP4HfIKcbxvM1U0kRghsY=	2026-09-17 09:17:21.689875+00
11549132-5bc8-473b-bb02-28ff3219eb34	0f27694c-f266-4ca7-ad98-05fc04317e8b	1	v1.3SfyUp7WZ8QyLQX2EHf0/4LK/zkua6jJQAzonZE/aejRFqzYnIW6bWCREbOJU6sgUO4spyXpYmoVByHp6Fb0NkZ1NUzJqA==	2026-07-30 03:55:51.904+00
136b406e-0073-44aa-ae67-9536eca55e7c	c99af203-0eaa-493a-9d49-96dab4f19581	2	v1./EIt+VsslN95yU5vnZV8BJLjZArVc2LuiVkfdYa1xq6MuPkB7RNZERUJrqJEo5m58s/2Sbu4viOcDmLRQxIwJCEhnW4D3KeqpZehOiVa2djVhdIJ	2026-06-23 18:29:59.664+00
14f3085a-3853-4ca5-bb44-f50701297f89	113ef68e-5641-4797-90ea-28f1997a2460	1	v1.BbcCVUf3VzkKbnup6J5nE26vzJAQu6GQgq2HRAesVKfeC9XkrtMnnBo7fo0zyn4PbLmqEhGjNlLj61CY+sD/T+oK2WXKyqqZ	2026-06-23 04:41:09.837+00
1a5e8587-3f9d-4caf-8f82-d96a9b0a7321	90be250a-17f4-4a6d-96cb-33d39ec5179f	1	v1.97HzZ0lYoh/9qUbLR794hPBdO7NEVjxl01wAl66LxbPUOvVmqjAT7TAmjLjRnLEfRxFiG9nioksAaUXcyorl2xJS+vldXl4YVt+fPJBuEhZGEV1mhezQU4dHWwaRvVBWdz7re+ovb2qhSXa/uWM21hb9RhiiaM646nIL5VVfk9SeHIQcCn9/VlKGAZYqTEi3lkNTTLVAU06VBJ44XFWSI44KVyjdQ4aL+SVYewCJ5kpFtMbwWGyaLGgwFIuBszz7PjQ6dxeF0xmjoM2ULpvGqHSvmtOXdxLlYq152Scl2fAJI+RpZOOTGvTRADxbnQiSV0O9WNPKCXotfZUk9dq/fA0ojdKfRwkIJZPlfNfUKERAYiVrhWizmWsN+hx2sG3GJwEKpxqYmnsoLQT6NFI4hAAy70LA4DBQV2wZhp+/wyNb57l+AcY3vjHpzxy8JROuIKkKhLCM5FtnwX34kgLOqQRlN5JMxXbCyrkQgzz+7pqg88spS9MiNyARbtPoBdWVzKY+IssUc9FVtVVOcHEMotQHcKfvS0QE1qK+dCzYW3sn4vrox+ZzbTzXz0hquKGhV3AjIO20R/x1SGsCT4SScWmzgqZr1yzvg5OUBf6d5lH/41BvYaqdAqWVkL3frjC5cvtSPGrmvY9u0TRT6q1B4M8y+exgFCAedVei378tTc6aKgjjMagxnTFoiVVFOgwLz4ZYE+5TOEjXxPLUAxCclhAwdyRzZPTAH3wumOGqaZlouQdOHCuqGqdDp+wHSgON4wH00tMVmdSPgbp47uZ+nixEa+N8wzU96tbAcev4Mq9PCi0mU67FMrT6K5Z+1gmow3x3D1Ia/V4r4WKIkIbMv9/JrxDFONRoaLGZdrd/lyO6551NSpLbRa02TpyoCOujDoZ6gZgmtziIjLOzqn6jC5dFYtcMm8pgGoeBrnYMIegCbwf+umYDCprhPLnLiA/Kzou0dhrFMYWyhaI8VTFrQvkawyqQvZwBwA0VAtAyemiQd9S52XuEelm/m67x9psXtUzeyUkLgm2f3hZCKxzavyuYRHlt8bUpzYZz2WryjcVcgJ2zHXnLufxBuFm2GP1R0EV7DoEPepopqGmQl/BEeiYhzWICrvsKxTuOyfMzU5MSRd1d3bYUyyA/DFrnt/aNeCP74wuSdK+c1SGn6kR34WEal6IC/Y59bU6t0tIqPvWq7YzMb13dX8caABITZbre5TuplysHr7f4FF58kvS0Rjbd8EB/ZdJHemuAqeRxeblmg/srARaCuqln/g==	2026-07-28 03:15:08.954+00
1c3a01e4-180e-493a-8c15-614231ba8bc6	5c6c75a2-9b9b-462a-983f-3ad74f664470	1	v1.CGjMwE7ECqTOAo8WBAed3JctXkHDbjXQXj5MIEJ07hQQOnqd2hUW9PTTCTm+HCXzTdd3KuayrogzYffzowV3rHMkQ0t+7TWk7U9XajluCYgC9hrLeJCO/Oe4nFI=	2026-07-08 02:45:30.79+00
3b2926e8-9355-48a0-897d-7177506e5a20	a0314954-bc23-43f9-b9ee-e9dc4bdc30b2	1	v1.4N3/XLxCf8rytfBU1REgWA51CbMNjJ3p7YeEL949HPZI9CHeNciqWqWvjsL4Ql6YGlH59pPRL9IS9Dss7UnUGwzuEBIQ9Q==	2026-07-17 11:40:19.043+00
3e984332-98ee-40f2-b2e1-b6a0852abbaa	15accf31-f2c4-4db1-b2c3-b1c3fc95fe07	2	v1.K0fLwh6pvxYrsBtNFJhoHOLHwHqp8+3kc717nrNSnSVJE/XIALt2iRyNoBfuKpqKqlh1LWz8d3Pfgk4MhjSoB1pdmuXQJo4ESVR77PNSUpmS6ZbSu2bmTNOeVt+kTGc/Fs6utBw7V/SZIH9s1al+EiTnHHD+4RzkUkw4YpuqK8Elocp6KtUsC6QGj/nCe2LlKv5h068pCRdIi5jPPQaVs+ZbtOsYgJaVWCS+H6LakImYlDsiBHpU0JB+r93xTKkiOOdWahrMSbMLUHoiZNfFMpVLRvaldr7RGB7UsMMVpdPP/ORsJWAIQCHlM/TnfbaKJl0Net43i8H7sE0ESL4hrm20GA0S6cPHFPcWrKgyL16SLlrMwFRolVFIs2cKdqR/HJMT4O/paCXJRVFU79fpPoIIGaHyh+m4x+zPjZ032o+FypKv2LIUVs8k2XuCW0JFgCOdVUuh5ohOF8JmUHTrC9b9i/htuyZ910w6k0PTQuAt/uMWNdYJrcquX4I9zSSSR0Pc7sBCamK7ipNOL/CHunD8XnMfbOl6ZBVtjcJeruKG3GAwGJkVidsDYE5xZWXv7VsftgzGHdK5B6rNJJm6/KoxDu+kxhHcPXTVCOh4Sm21ad+YGEGfXzCj4dWOno2gNTkyHxyeCPZkNeFZ	2026-06-23 04:42:52.741+00
43d187bc-660d-4540-99e5-da1f00744aba	bfa9c720-bd88-469e-abdb-c3cc1786c731	2	v1.u53kdCRoXjl51/DX2LoOhwP9jwNhAi3eXwGDmllLU6+b/Fj1uIqpjQGVkyAu65jzLYv18igv8ipsNVUIgWGKPmS/JnNTYd2AgQGXeQ==	2026-09-17 12:42:48.190079+00
858bb4a2-287a-4723-b754-89dc2a850394	b3ccea44-bf82-4187-ad2c-49b01b9ca768	1	v1.BBhsxp2wpQNoVgeCDV5MYFRHNKUoJS5SCYXx+ZtnFhbODa2bOvaOmi5V3tcycRDvIiU3Tai7J94SKQO85fF91/MfIyN6jBK+PQBPdA==	2026-07-30 03:56:03.558+00
bd4c6a37-fcec-435f-83b7-603b43b9080d	b68e4955-ffff-4070-a090-a8f29cf01ecf	1	v1.RBP/RrdGykKRFxwD4T+8hH2eB4HKNZJcwjx4um3m8geDeblmtDptFxBG6pvAXIx/ie7BliTMT7zZ1cvezztJ	2026-07-31 03:43:26.823+00
e47473e0-823b-41d1-9b21-501fc76c0b5a	c56dec00-a77e-43e5-ac07-e7647560eb27	1	v1.DNsvZSglijvVfjos8X09hU8ijMpfxuQ10KEX6iQeh5ZyKXSroIijoCeEk9CHDiXV4ZABf4mUSC73hNUgHw4xrUPiPMM=	2026-07-30 03:55:56.685+00
e6f3c740-8f55-437c-a389-54a3b3103334	e8174b3a-6bfc-428d-9501-9e2127757fbc	1	v1.K4WTLas/rr1AQsSfTcfDXNWVhbMrUo+LS3b8AsD0gk0k42BFdCL1e1w=	2026-07-31 02:33:14.845+00
461bf669-8cfe-4d85-8fef-8389cb3e6bcf	1810cdb0-0505-4834-a07e-2f6e17077624	1	v1.H8g1jh3j1pvQOzZgkZhAXFxm4KLFI4eqm6ML4dDr63fwMidNf3sQ+7FSUd7Reg09O6axhPw84MJ69vshvEPVfgKq/gZV4hxifZXQewT8u0YgbgAByeciMQghKMQmFy+2IeQGya53WtnZjRfnEAUS4XA52UF3BMNZG1Wj4dEibVvBb7PoFlHs+LkD9kiSCQeOi6mXWcnzvdzBAgk8m4df8NuYqTMjrHFpCa26KBRFfRv7ywdrC9U7B/6JACCxigERs3TF5k7+vxgs0frLkhfMx5XMpRi4tnpWT792qjT7/h912UZuHnDnI4tSrMC2HsGgl/KlRiJiNHG8VvdYVpP9HSLitOHNhedKlH/G1nOR8bG0b09Y0jXeLKOeptoAD1TKf68LwIr6WMENihZmKpu6IWSQcrnMtt/Q7UDF0+MS8DmiOLIq/g6jq8qaUjXd79DylhhuIZNXVQ4BGkCHyuu0iLUAWxJwDJJj0h7HzB5xVpV+fvsjcVXqkKdigIwc01Fw2vsUmlsCn1O2hF5t186fw3u0WYCxfdQLc/uKx00+oE8Pvc/XD0MpO4JVikxFFJvxDlxeG4COdSCK1tSPe1eHQ7/X7lWTfEAjrokTsgOgsmcYXUs2pdIoHF2YI9aEL2C2HDlQsK5WwCMFPBRq8W8iRIOgD+PP6k/KBsNWuv3S9gb/APngX5N/yxRhoGhjZoAdEEQ26vJd9XvWCfRNVbV0KLi4ZVEG8T4+l3JcxsAF4lwrTitsdsZYHefJMQOpDwEAdkU5tl7SNf4gdjujhsuvJZ6tZIbdibYK+3PKOWLKvkxYEizSlALBRl21mqs3Tx34okif0RYXkRMeOuDkN3KYvDFHPnHvE2uethVxqLaUUIqleApN76zYRMEEEDgNq4NwDzivv3sgxycBnaZrFbVBK71HqZPxWnThVtliGKL/Gf0wlaQP6EtJjzOKvXSLlLCDqdTYBbTS/7fHM0YDxxP0x37dG84OSXgpylKZT/TY2wSzof/CTQ5aI8lepmTf+v5Dlt2Khar2E4s2Z9A+pkILc3iOMCSaCSCRraucwkxWfebgHU3IJvbxw310MW0kpdw5tFi0B0ogtDirCmn+RJB9KfWUB3vltseGD2s0RVT+uNx8kFqGpmu8qo4rkstNC5T6eMr25J1bsPkbhQ/0Ye6TlrVpjmM29Ops2YFYxlwOZZjYlBSTdgIFb+vmtCKx68xeeSS9Gnj7NlCvUvDsrGcPanfcfQM0MJym/yHRPJ6ZjuX50wBkGZOZiACwbg9BFnWrQ20M091ek6r4noVkMH+N/xYWYsUTW91diMaPv/rSPE82sEUAt2wpEiCTgzfQC8f2DzBGg4zVPN7L0oxQatmHcgnx1Y5B0snfN4vD8oilTzlio0LnJtLTwJdCzr6riofd8hTJSnU+pLD4x6Gk3VJ3caSG2gKHFSw/JCC6uNZaiqQkbaMDbzTaRITRkD4tAeJKGgAASpXslsPoUw2dOOAagw+Llslr4kUURHL3lVuhtxXrONv8PAuGbVrs+4KqOhgxU0wcnvPhPWtuZ8hHB4ZWjZ6tQYzrmFrJuBMMEQlNlQnvf2JyzsJ14kXr91GOY+ss71dDx8vGjqTx62MmhgP16+745Yv+QwO6xRI5AhKL3my7xeipuZbVngI0dYHQZBEnPknmLTomIv8l6iwX2rUB0yp8h8tWrLW/oSR455TJxCzYxi5R/CgtXdFuUL4t/R0xdlF5uVqZiYleRDqOnrP46HMzwjFSiIvzM04GGKBIsmNJ7ivB2/ARQzXT5OXIfEnR58LXCXMcGGXv5AssPhNoquo5Z14tVtzCF8iAMbpwLYb+O8sJqu10	2026-07-30 04:01:57.324+00
4fb56f2c-901e-4e8a-8734-6fb468334e9b	21337375-793c-4945-a635-2b109d311a48	2	v1.B1bHKtsONsTcDQoPMPfEWY7AbFGsSAaarsOU7phMMOj/G7hYedSMpDhHou7t1Az1jqHDRiZ2jE5FdYV9CT6z2AwDHzczfSbJpGyG0AZMXUF4Gj7edy0zlxqrUGuBRw8=	2026-06-23 18:31:19.502+00
53ebc41c-e705-4eb4-8ab3-1170438d7b12	3cc3d37d-2fe3-4544-80f2-31095f6a17c0	1	v1.2zRMx5MDOYN4FnJaxl4wCWzdxaAjG+ToNoVedH+0gXbF2QklIzCkVY18gzHbMYoKnEu2PcD9f3k4do8OqWA7XYkS90/Enj1ATJuidNG0eoOwU/lighgmptQsnvooWCKmpHXwOW9CxUUdW9SpzIEpzlC7a5+Au8WC+bVevSjePob2Jt2+AjffMyyC/JBe/WyaYmXZKqps3veoekP5Lk+36OYO/hxd3dzgRmoyR66lQSDeZJZlZQnmo9reTwo+io+OIsDSrYQOVratuZOZ/MlN7GxkTfA7J+g/bP+NNsc6GjJT0IdMIvAxQs+OnxXgDV+qbRqHaonQ8+IgxrOQ83w1OItaW9YI3R/Zp5Y1m13pHiQOGtr6RPlsV+ksclBP7Fbz8FdYY+MIhtiszSLxOBVFEey3uKMRYiE5+1f5+RmOnd4eSu8aH5ACyNkyJaaKc2/OIj8JSkhQuSVzNf3o4ZLJFxydHjoNsTMqX2B20IVs+LBRakawp+E66lNl0P1BT3oqX9kjk92JFXp+KxAwNa8njG9L3Dr4+vVNoTxIby1RMZnNWSonCDGOLUPQJ28j/lVR6W3GFLZn2iCSzsVKxog6v8vEcct1XwgLF+hD3ukV/r2W8VvsgDTta6j6bvTSOHZH2WH+StQgHAn3ysPRwHi6bor8pOTOR69DyKlo96OjHvKg5NGfFW5ooIsYwH0xjTYhDyQ2E9r/GulB5Mgjic+yJjtSj7ae1GY881C6ZI537uo9wDEZRlDliyG/yxUsRwTNF7+jyQFjcH+8oILIp1xq2XKgtXxIpXOPF6bzrtCgkJvqzRWC6Lf9UX5xhkQiTzh9ZEQ9d+d5Pd8S0KoEMxVQEAF5Wjsn3v5jCbQgKSqyNQ9TyAK6RAH0YktzLkeKbyf1JMZ3wuh26tyo/uu99xsgx+ZEYJENFqAXNYI8LX+R425WjKSfWXTVYJb5gEFRTI8cBaCiZnxFgqvRBcwaVYIEd5wuG2yOIwRCZ37Rmw3gABEparRCZT0+QbBbmRBNFfL+13fFosxePru8tLA/vyOnvSuBwL/iPb4eDShDpfCRE0lP4emUaFCN61cDXqYy8S+Dan9Oj8bANiyhDQfUZLqECCEzDxyNiUFghdHyHrmTumAf72s6rIr4Aq/T+VJHol3MYeCoeuhnEWlUHTqpY8KbRZX4ebd8XR2cRnNzTnRXbX/oDnlY1H6LhPqg3o9ttrozWmDTZ1yvRUN1KVCaH8gYkkycz2MRmwBwTROChF4o0X7NNNc7ltK9bEw/N2puX0pYRw38hdwNeAOEixoqh1tAEDgUKXae3S4qLRfKU28VChpr2OTYfS5g7Cs4MYfwIg9E3uQ6Xh1gofeBeEpqn9mh3Ws1jgls/r/GQbIu/RRQA+CcYAzE5AXbcbILWtc8SQt5xbUF2y06CETJ9Sm1FoZJCMM4+YawpB+SfiTmC05FDETIQj9oxf1fkBe6QAVEPN0aIMDWzmA8BAa5FPnEnz8wPtTQ+cLb+HH3J2TW0dL3TYVeRtI=	2026-07-16 08:48:58.721+00
6ed86170-b66c-44cd-a248-32a293334685	6e89d787-0ef5-479f-9a95-3c7e6cedfe1f	1	v1.RmQ2bsb7LlQ+RFlcd4X73YiWYizeVZJV+DzG6+nprb4F0ohLqC6V5K/erFesAOY1dGqfo0SnBykrvUHvgs5gVG1i5q6VCWraWk2Yw4/KjhcviZxwyfvT9AblfPIv2/lXcNFwI6O0l2RFgFmEUkGYg3l+zcqpbwwxTDrPXdwyyaE=	2026-06-23 18:30:12.693+00
74eb4314-6c41-4fd3-8821-9a2e09deaec0	77e0716a-db38-44db-bcfd-2db980ab4bbe	1	v1.C65BGxBN38e/SXJ6XuGYn4j69J7KmSbB1ZAo8nvpfI3sRYwaEpa60jdllj5TtT4EeMzMZSKtIwyxmalhdUePg5hkCwSsxCUK5uK8fY2ydo1dNacmIDH5tkxW+hSouVo18NVjifh3novBIS6sDUq5KMDFl2PQhBJbFcRU1iVwpg==	2026-06-23 04:41:43.48+00
8190bf6a-eadf-4ad7-8c53-5f6b3683b356	c99af203-0eaa-493a-9d49-96dab4f19581	3	v1.p53IMvzTTVBJZKQ3A9wUrnBpOn4MnVhWFlcENAp23wvNtOHH7FNYnywwgON5/k57PWuwOzn9FoTe6zEGsezdkEYGxfTC/MW6+1+H1TppkTvA+f3HP21MSgeLoNmegcp5Yw/eLu9iVfNtnuTqI3fbNP9/O1Y7XMreGWWLXU0LrchRR0I=	2026-06-23 18:31:40.281+00
827f51cb-a2da-4963-9355-9c7a0113c11e	184b2308-0deb-4086-8f52-acd2e8e2d9fa	1	v1.Wv5a0VjLC5H6eWOWSxY+l3rf3+XGSyfukNbO5cyywyuoFdZq+HDxuuysHypAZkinMPBQlg+83qQRqvBS0PQtPYaRYmRCYEACZzmsPf2hM7pGm0EvSbRKwSVXrOId0qRb9+2lgqAMxqj7Pz5tczq3H0uiKvlc4AGkKIHhOJVCHEAN8Hi3A+oJs7OnVTZIaGwfnrjCzez/tfW8Ag==	2026-07-19 04:21:54.497+00
9107817a-60f9-471c-8521-a95f95ce60e5	32374981-09af-4bad-980a-ca2db0a6cbc7	1	v1.csyvSiBYr9ERNSy6m5NZoO6DPZty4jDVOC/zm1Dypgr+sBmhtGr5gdrkAZ1g7bPtJDnp3v0e9r5hA8ZUUhbnQNSBBGS7h8Ohe8aRR04J4pI1tA0fjLd5VF8=	2026-06-23 18:29:53.708+00
b65cff67-d125-4e3e-93af-f4ebd555650c	c99af203-0eaa-493a-9d49-96dab4f19581	1	v1.lqKuDoO+wz3OOiuSDCzfykG0oHZpeA44DE+nyYwrmlg/5Iu+D0OHoAv9Wt7gZLrZbKci6/6ebt44lH46/QkXOnjCskYytq/Md2WRqygRTZPOpWLgLkCH4mzhysgyy35q84q/RomeFkC9hl56v5wL+FOIqPQfEEl0pzD5u1uG3rbb9Rmb6DBgrq6PlEgJBjJKkmhEqZlgPPUk7M3JfwHnEUe8+qjhImk8/gdUqIVLkYZCluHUcsv3cqvknc1U7xRlmr5d4hY7hXqXp1Avc7ZdbP2ALH2Ov3vYT5okehtcwhOdqNXzubY=	2026-06-23 18:29:40.459+00
b99cb5e0-dc0d-453c-9707-0f9548b86770	17fbe6a5-5604-4036-8d27-ee82720583df	1	v1.lYreTO3bkzUMcSxNYudQ6pk/sjfK3t0PD+6MHrs1CTfvvk1MOPHjC/oGF3m8m9FPoEgj5dIkvMlPP3Uh62hj	2026-07-17 06:31:16.173+00
c4a04f5c-d0c6-4ad2-a329-3fbc721399dd	15accf31-f2c4-4db1-b2c3-b1c3fc95fe07	1	v1.PC95y9CgoaiJUl3lUD2Eoa8xxs9KQ011uelMlkjnTED7bHP1rGTHuF7mWNzKmKf4DWWIsPN+6ZaomNqBoWwMn2BAO0F7PN+1xDu1hCy8yj9g/+yrzvqK7UxRVBcJ0ZndSMoKIJQNrWT2JEOa8Kv6EiHIbwKEzEXiscxZpS2JTlLHghH0g8nCDoqcL3P7Yzp8winnSnJ903ZDgQLg3HPfkyyHgJ3ocncqM+KZ8JdAc/LbQtU5ug5YTGBEB4G3BqF0FxIuASppQ5dY9HxHVTctqic6fnXknKgLwQmY4zZScht8IXirgmcwcCnlRRl/I/ttNEbiNohyafh6S1X8dJYOwpr3WGJOi04H7ckeSrQH8V1DlBOR393pwe+aMYdyWFbLTwhw08p9tZV4//WS/TU95GxyiTJR/R+nsdUdPiCP4ydEMjjWDRhgmrpemn2yTAD/aJv1b/vqFMceItx1lidqhCJ+h+hEcM93luwb6Fx9Gl3dXF6u0qb5QLeHuvlswjDWRRzpknSvRunAaAkJIQGoJEu78YKZweKcGQdXBoIecswsxzck/kpgYmrqicZlrRdn0hf6EGulA6JbG03thTgrpMXFMj81BftQQE0irXNb2dBKJ0IqxmOd4AuPqwpGKb7ousX401GyPulPd48ram0gFTmg3VPfbFvJ+bmpvimekDhafpv04AgxKOkwp03IQgFkycUW/aucHnaQGJQnROE1RGXcFA3AdOUS6t+w6QJoZbwSbL/Yzhevkg3kJ78F6X0RoI5ABTbAiO15O2dsRuGPSzL/8eo0pNrf+MFha0JpqfBhffP5e9OqrdxaNrNlSo6N/MKDuCGFr91SYFSMOH/If0G6M70FyJzRPO1BUk3118Zfk2IJ/Xl4T8Kw/U7KBq5ZV/iZKFZygS256RD1Yj/tRZcaumOqFGdkB7QN9F/A5TQg+Dx9TwSgkJcRI9EJ81nlUSVqAgKCmZCrDBH/wnZwVPGwFL1GGDcVQgBnHJHdD+qX0oqAB3vlmk1dr2iT7PyqftEaJWtNEl5jmresQnqUNPVlypvFipeMQJ9XY1FSIYUm4WYrhzzQAJWl+KBPOIoU6od8jkGJJFjTsnu+vh2ogdcv9D2Ad5AS5dxC4jM8tx8l152L2Kr+AyQYvMYZ3k1fp6dbA3T6e8dPfjCn6tbRo5gAspQPLJpto8g6TgJB20pVpZviewkAG4VuXCnlDJ+8spuzOuPQ01dD/7L2CP1FtSyrY896C+PrHjaqYoRhB70r9UC4+jdnhUQrnYAU3JbCMNK1LGuHRuGcYth9k6rjBUTakUVVM/opjWOHjrXQoPu9SS3YJLfBXCqwiA4RtEmKfciCdlJeiZ76FpBxC3LuJtmpKoGrDx6/aecBdbkgjQ904SO/845vEhz0BTCKdsu33GXYCyQZefkGHXE3s35Qr3Mo5dbwYZ9xEXDefa4tedQ6ACrTJnL3w26zSfKybevvXps=	2026-06-23 04:42:37.827+00
c961728d-e2dc-47fd-afbe-d9de71058198	be304cab-abdd-4763-a9b9-7264808a5cff	1	v1.7PAHbMBkd8rTKz99nsmI/0p+bqH2XHFdLMWwM8JHZAjXnhxbu0JYbAI2kP+fH2sH6/GoMb3ct09Q	2026-07-18 13:51:24.129+00
ca6cf2ce-e167-41c3-887e-eb11e25e9d7f	eed710ff-1adf-4de3-980a-a793aadd4d4e	1	v1.NyDqUF5Ivkw9hkjQ2eRzngt1iTFwfbrT7cflLQJnZjPFINeBuDkaSeMKJpQvbdgqNcVImGS7FTm6QnvZKvv7M8jcagx8uzzPhS/NB5dCjIn05G2floYKN1KfPycwNaFn0OVhhD6+8XSd3spNNuXhbdVVtm3Aw8aDknBKPu2J5UA47N1Hw01jbD5GHJ1E70hmZdpizv0PLoZle8ouNQzCvBkMke/lW2c5VtcknYsvd6UHd7Naxh/eOpYss0WXW3xbR3dHRCMkvo0=	2026-06-23 18:30:45.211+00
d1d39efc-7531-4892-9158-c9cd5cbb0212	37acbb91-fa9c-4ce2-a40d-86af7cd90dd2	1	v1.hLUjPeQweWFGR2P0jRGuc9GM2auVU/i9we24cNUgMsqGEfcPpt4FGuofrkIKEnG6ffxzaSskJgEKD2BuHVUbWGNE490d3ux6M0ymout1+g7C61jK+s2iG8ZLeuvbm3I2yqrB0MBm1+UehxekYNfLIkw2dluUy8vNaQeaZsU94e4YdzTH8hKIFi2sC/dqcaULIsVp7KNHHd3vkYzWIuxnI5xOiAyW7Lh8cFhg002ZmqpFbWR+inmmA2Ixr0S8mSvxc3OyWE/oX2aoZE8DMcJgwVjTf5OmdFxdwCjQYeSWC2/XKh1dF4oIVzCNUlKNvzt+l6gg5yCqoyCytBDEcO4QSx0G7kqBfk8qNeWrpZ7e/U7qLd6DhNIg6RXxNZNwCwgy5wwL9GahSqsjsTWszMT1yG4AoHc1Mric4Ct7koL7ggg5BRLJNDraIEF35EV/LuTRWhgD8VaHPjX210TvoHpNj8Jszenn0fmMvC6vlfSRDhabVo0KMOws/SLSH9t9lKbcPnag211SEl829PTS//hXaj8CCinupokKLoWW3b/bFnXeO0TGaCtzyVNK/XH3GACyS70U2Db0jK1xzbqPZ28DwfdWXFY54sNDX91MTSuHCltGs+hy/JERztMP8CRmNu+JfVQtYUuWliMBGRHed75lpEBPq6vr6bpJ87EtSDD04jPiZ0bc7tFgZAUX2Ef6W+qcthtEsZigx+kYDZZXb7PDEOuwUHzWJHrJPCwiSjkmsXdTmuwsDSs661kTV8aluZcAKFAN/yxlxfuMPsfp6knM/zI8RRyk+YQGJM+O2F5d4CsjcVcdkikYNqHGjL39kBfrl3JkkezmRFIwahOTU0IYQDy6TNduOV+fmyV/S7+ZFj2DYN3xXVxzMVJ6o5ccQiyH5K80fnTYIABqEWATu6jiqc+YGaWSs9EWjLklzSqF6njSPIZ0XIDiI3s=	2026-06-23 18:30:52.311+00
d6413c7e-7a89-4dde-995b-e48fec07e811	113ef68e-5641-4797-90ea-28f1997a2460	2	v1.F+iYX9dbPxKEfw/xKGmovOMMCtj6rWMozZnDfPVseMM=	2026-06-23 16:31:19.969+00
db38ad52-6d88-4798-8802-c616126d1441	5c7fb0da-cb0f-4fde-925f-eab2c24aef2f	1	v1.qka+Ie/oeLTaPY22AQL7su5TEIfFXi1VM2wd5eu/doHm7IUSFAeIUipiL47qqCYE2dgMv43aSlWaQx76EJQkiJXi3tcWweGeSwWDsUshIWNiM8Jnv2AxSVGXd43BSzpNkaxCwSQUy9o2/2AuT0f+aGeTRwRg3RHB4RL9PbH+UnVWuruJWIPzxho0dyMPBOk6W+hmvlwtApXin/URMOvAt5tCXdDxXN+8x9WDJnhEd/ctJSLSaf7VG+1W/Wi211lIux13lXB6o4Vwgc+12zi7Xz/knK82ba8rJQx8uskdQ4y5O4ez9SuQMGGhKTzJnzcoMbF3AGqZzzMWs2zzXNJdjgDl4MOub7k/ZUoBN/V63RRK4jXbLocywzglnqpp4AVxx2lwjhEX0Rx9eR85NHfUTuOdqzWOtZHdapXNQVSEJy9laBQNQau/E65KUata78+oeYmKKU8qEeAS+0WQ3UCI8FnpUwl1CjnxkUCuMQIxwF+4LIytlQ==	2026-06-23 18:30:35.58+00
e21ae987-2a75-49d3-9467-a8d97a50a377	9d593844-1756-46cf-8fd5-e388c10c03e1	1	v1.Dsxda2PpLtp5NrilcSfm0VrtVjCV8/cNQU+c0F2jlNOsuTq8v4DhmEyHj/RNoZBDk/tnsuuqMPHCbWiXdn89OgpmsV9llkyRdIZMpaTowgZ1BJBc04uKP5Eb/aojujHqBDpn0m6IP/hBum5nxsu3SjRwhGyJ/0JnvdhVZ/4UyMbNO07cfY1Kxp1mvqdA78A0aZV7UZTS3MWqsZZ67woW	2026-06-25 03:55:04.192+00
e51bef25-c095-468c-ac83-5d8e16d772e8	d1421f41-71ea-436f-adf9-eff7e88497b7	1	v1.Io7Z/8ogMzq2NTZwGUou+JyLEsbAgdd8kV0LV2q3nLbtX7tWlJmAqegfuTj8aYHuQ4hUxd3JWB1g0r0/qpvpjZNL2aF+T9P5KAgp	2026-07-30 03:55:47.044+00
e90ed981-1da3-4035-9397-6ca7e2cb4860	9f0d1496-e085-4a93-85eb-852377dc66e4	1	v1.1pK/u5b8iEinCyll7F63rGDrFUy/Af/5Ei78wsp5ygTnViSum0/AlWztW/e7BBYaju7qCjNJ0PSUtUNaOU1BQvh7tg==	2026-07-30 03:55:29.471+00
e9277986-22dc-4cdc-ae4f-fd0c2b55336f	21337375-793c-4945-a635-2b109d311a48	1	v1.RB2PULBbeqP2EO4BrplBZw+qDYKLTq7S+AZ0mNXpCUvJC311cxGGXcnZecIfC7Ch1qHC43QteZtzjMQcbTo9UxqFgvdTjKBXxr0x1HxnOqZUFg4TwwhRVwyx	2026-06-23 18:30:30.575+00
07bad614-13a7-4898-9bcf-b4e47ea10422	27e08aaf-576a-4d63-86da-1f529b2361a9	1	v1.Arbbkp4DIU83leHlxZh/FfOZhPbfBjwPnUg7K3erfSUS4HgL4RzBVRE9rS+QWVw=	2026-09-18 05:50:09.857816+00
c99cbcc9-3dbe-4093-9a07-f674a10f4fb1	27e08aaf-576a-4d63-86da-1f529b2361a9	2	v1.CwH8OyrLCTSow5LqGWlRgwWlPrz3gFfKeGzrWGFXcIxk6wNATrnVVEyYXSyO88DpgCpOym5LEtbFmSqUU6eTDUiGqA==	2026-09-18 05:50:27.25679+00
1e1638ad-791a-468c-8e04-1627f431fb9b	27e08aaf-576a-4d63-86da-1f529b2361a9	3	v1.j4oKsa2GarIh42XjiiAzObLEELVlImkkiSRaN9UZspkFDTx3Jkeqqd083WyBDPwdIS44DcRY967+uU4AyI/LJcJnwvSi18qeTT6SQzZiSj+v	2026-09-18 05:50:47.066934+00
\.


--
-- Name: ideas ideas_pkey; Type: CONSTRAINT; Schema: public; Owner: idea
--

ALTER TABLE ONLY public.ideas
    ADD CONSTRAINT ideas_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: idea
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (name);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: idea
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: idea
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_token_hash_key UNIQUE (token_hash);


--
-- Name: users users_google_sub_key; Type: CONSTRAINT; Schema: public; Owner: idea
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_google_sub_key UNIQUE (google_sub);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: idea
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: variations variations_idea_id_position_key; Type: CONSTRAINT; Schema: public; Owner: idea
--

ALTER TABLE ONLY public.variations
    ADD CONSTRAINT variations_idea_id_position_key UNIQUE (idea_id, "position");


--
-- Name: variations variations_pkey; Type: CONSTRAINT; Schema: public; Owner: idea
--

ALTER TABLE ONLY public.variations
    ADD CONSTRAINT variations_pkey PRIMARY KEY (id);


--
-- Name: ideas_user_id_updated_at_idx; Type: INDEX; Schema: public; Owner: idea
--

CREATE INDEX ideas_user_id_updated_at_idx ON public.ideas USING btree (user_id, updated_at DESC, id DESC);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: public; Owner: idea
--

CREATE INDEX sessions_user_id_idx ON public.sessions USING btree (user_id);


--
-- Name: variations_idea_id_idx; Type: INDEX; Schema: public; Owner: idea
--

CREATE INDEX variations_idea_id_idx ON public.variations USING btree (idea_id);


--
-- Name: ideas ideas_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: idea
--

ALTER TABLE ONLY public.ideas
    ADD CONSTRAINT ideas_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: idea
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: variations variations_idea_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: idea
--

ALTER TABLE ONLY public.variations
    ADD CONSTRAINT variations_idea_id_fkey FOREIGN KEY (idea_id) REFERENCES public.ideas(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict JdhQFVzQ27KAHyZH84bKiFaXAcCGagdfV9xGvqxdXc85ezAuQLxhPhMb8n0Mqrp

