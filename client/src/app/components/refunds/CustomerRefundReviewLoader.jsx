import {useCallback,useEffect,useState} from 'react'
import {adminApi} from '../../utils/adminApi'
import {useRefundRealtime} from '../../hooks/useRefundRealtime'
import CustomerRefundReview from './CustomerRefundReview'
// Adds review tools to historical/project refunds without replacing their progress UI.
export default function CustomerRefundReviewLoader({refundId,onUpdated}) {
  const [refund,setRefund]=useState(null),[error,setError]=useState('')
  const refresh=useCallback(async()=>{try{const result=await adminApi.getCustomerRefundTracking(refundId);setRefund(result.data);setError('')}catch(err){setError(err.message)}},[refundId])
  useEffect(()=>{refresh()},[refresh]);useRefundRealtime(refresh)
  return <>{refund && <CustomerRefundReview refund={refund} onUpdated={async()=>{await refresh();await onUpdated?.()}} />}
    {error && <p role="alert" style={{ color: '#ef4444' }} className="text-sm">{error} <button type="button" onClick={refresh} className="underline">Retry return details</button></p>}</>
}
