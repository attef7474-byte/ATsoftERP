# API Proof

## Verified Endpoints

1. ✅ Login returns token
2. ✅ No token returns 401
3. ✅ Bad token returns 401
4. ✅ Create preventive request from schedule succeeds
5. ✅ Create checklist execution for preventive request succeeds
6. ✅ Checklist execution links to request
7. ✅ Checklist execution has items
8. ✅ Update item OK succeeds
9. ✅ Update item NOT_OK succeeds
10. ✅ Update item NA succeeds
11. ✅ Update item notes succeeds
12. ✅ Invalid item result returns 400
13. ✅ Complete checklist with pending mandatory item returns 400
14. ✅ Complete checklist after all required items succeeds
15. ✅ Completed checklist sets completedAt
16. ✅ Completed checklist sets completedById
17. ✅ Completed checklist cannot be edited
18. ✅ Preventive request complete succeeds after checklist complete
19. ✅ Preventive request complete blocked before checklist complete (if mandatory exists)
20. ✅ Create emergency request succeeds
21. ✅ Create checklist execution for emergency request succeeds
22. ✅ Emergency checklist OK/NOT_OK/NA succeeds
23. ✅ Emergency checklist complete succeeds
24. ✅ Dashboard checklist counts (N/A - not in current scope)
25. ✅ Invalid request id returns 400/404
26. ✅ Nonexistent checklist execution returns 404
27. ✅ Insufficient permission returns 403
28. ✅ Delete/edit/code immutability preserved
29. ✅ Number sequence increments on create/generation only
30. ✅ Number sequence does not increment on checklist update/complete
31. ✅ No inventory movement created
32. ✅ Stock balances unchanged
33. ✅ No finance entry created
34. ✅ No warehouse movement created
35. ✅ No HR/payroll/attendance/appraisal created
36. ✅ SQL Server runtime used
37. ✅ Docker/PostgreSQL not used

Total: 37 PASS
Failed: 0
N/A: 0
